package com.fiscus.tap.plugin;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * FiscusHceService implements Android Host Card Emulation (HCE) using ISO 7816-4 Short APDUs.
 * Handles SELECT AID, GET_TRANSACTION_DETAILS, SUBMIT_PAYMENT_TRANSFER, and ACK_CONFIRMATION.
 */
public class FiscusHceService extends HostApduService {
    private static final String TAG = "FiscusHceService";

    // Canonical AID: F0 46 49 53 43 55 53 01 (8 bytes)
    public static final byte[] CANONICAL_AID = ApduProtocol.AID_BYTES;

    // ISO 7816-4 Class Bytes
    public static final byte CLA_ISO7816 = ApduProtocol.CLA_ISO;
    public static final byte CLA_PROPRIETARY = ApduProtocol.CLA_PROPRIETARY;

    // Instruction Bytes
    public static final byte INS_SELECT = ApduProtocol.INS_SELECT;
    public static final byte INS_GET_DETAILS = ApduProtocol.INS_GET_TRANSACTION_DETAILS;
    public static final byte INS_SUBMIT_PAYMENT = ApduProtocol.INS_SUBMIT_PAYMENT_TRANSFER;
    public static final byte INS_ACK = ApduProtocol.INS_ACK_CONFIRMATION;

    // ISO 7816-4 Status Words (SW1, SW2)
    public static final byte[] SW_SUCCESS = ApduProtocol.SW_SUCCESS;
    public static final byte[] SW_FILE_NOT_FOUND = ApduProtocol.SW_FILE_NOT_FOUND;
    public static final byte[] SW_INCORRECT_P1P2 = ApduProtocol.SW_INCORRECT_P1P2;
    public static final byte[] SW_WRONG_LENGTH = ApduProtocol.SW_WRONG_LENGTH;
    public static final byte[] SW_CONDITIONS_NOT_SATISFIED = ApduProtocol.SW_CONDITIONS_NOT_SATISFIED;
    public static final byte[] SW_SECURITY_NOT_SATISFIED = ApduProtocol.SW_SECURITY_NOT_SATISFIED;
    public static final byte[] SW_INS_NOT_SUPPORTED = ApduProtocol.SW_INS_NOT_SUPPORTED;
    public static final byte[] SW_CLA_NOT_SUPPORTED = ApduProtocol.SW_CLA_NOT_SUPPORTED;
    public static final byte[] SW_INTERNAL_ERROR = ApduProtocol.SW_INTERNAL_ERROR;

    // Protocol Constants
    public static final byte PROTOCOL_VERSION = ApduProtocol.PROTOCOL_VERSION;
    public static final byte ROLE_MERCHANT = ApduProtocol.ROLE_MERCHANT;
    public static final byte ROLE_PAYER = ApduProtocol.ROLE_PAYER;
    public static final int MAX_SHORT_APDU_PAYLOAD = ApduProtocol.MAX_SHORT_APDU_PAYLOAD;

    // Session State
    private boolean isAidSelected = false;
    private final byte[] sessionNonce = new byte[8];
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        if (commandApdu == null || commandApdu.length < 4) {
            Log.w(TAG, "Malformed APDU received: null or length < 4");
            return SW_CONDITIONS_NOT_SATISFIED;
        }

        byte cla = commandApdu[0];
        byte ins = commandApdu[1];
        byte p1 = commandApdu[2];
        byte p2 = commandApdu[3];

        // =========================================================================
        // 1. SELECT AID Command: 00 A4 04 00 08 F0 46 49 53 43 55 53 01 00
        // =========================================================================
        if (cla == CLA_ISO7816 && ins == INS_SELECT) {
            if (p1 != (byte)0x04 || p2 != (byte)0x00) {
                Log.w(TAG, "SELECT AID rejected: Invalid P1/P2 parameters: " + p1 + ", " + p2);
                return SW_INCORRECT_P1P2;
            }

            int lc = commandApdu.length > 4 ? (commandApdu[4] & 0xFF) : 0;
            if (lc == CANONICAL_AID.length && commandApdu.length >= 5 + lc) {
                byte[] aidReceived = Arrays.copyOfRange(commandApdu, 5, 5 + lc);
                if (Arrays.equals(aidReceived, CANONICAL_AID)) {
                    isAidSelected = true;
                    secureRandom.nextBytes(sessionNonce);

                    // Response structure: [Version (1B)] [Role (1B)] [Nonce (8B)] [SW 90 00 (2B)]
                    byte[] selectResponse = new byte[1 + 1 + sessionNonce.length + 2];
                    selectResponse[0] = PROTOCOL_VERSION;
                    selectResponse[1] = ROLE_MERCHANT;
                    System.arraycopy(sessionNonce, 0, selectResponse, 2, sessionNonce.length);
                    selectResponse[10] = (byte)0x90;
                    selectResponse[11] = (byte)0x00;

                    Log.i(TAG, "Fiscus Tap AID selected successfully. Nonce generated.");
                    HceEventBridge.getInstance().notifyAidSelected(ApduProtocol.AID_HEX, sessionNonce);
                    return selectResponse;
                }
            }
            Log.w(TAG, "AID not recognized");
            return SW_FILE_NOT_FOUND;
        }

        // Enforce AID selection precondition for all subsequent commands
        if (!isAidSelected) {
            Log.w(TAG, "Command rejected: AID not yet selected");
            return SW_CONDITIONS_NOT_SATISFIED;
        }

        // =========================================================================
        // 2. GET_TRANSACTION_DETAILS Command: 80 10 00 00 00
        // =========================================================================
        if (cla == CLA_PROPRIETARY && ins == INS_GET_DETAILS) {
            byte[] activePayload = HceEventBridge.getInstance().getActivePayload();
            if (activePayload == null || activePayload.length == 0) {
                Log.w(TAG, "GET_TRANSACTION_DETAILS failed: No active payload armed in bridge");
                return SW_CONDITIONS_NOT_SATISFIED;
            }

            if (activePayload.length > MAX_SHORT_APDU_PAYLOAD) {
                Log.e(TAG, "Payload exceeds Short APDU safety limit: " + activePayload.length + " bytes");
                return SW_WRONG_LENGTH;
            }

            byte[] response = appendStatusWord(activePayload, SW_SUCCESS);
            HceEventBridge.getInstance().notifyPayloadSent(activePayload.length);
            Log.i(TAG, "Dispatched charge payload: " + activePayload.length + " bytes");
            return response;
        }

        // =========================================================================
        // 3. SUBMIT_PAYMENT_TRANSFER Command: 80 20 00 00 [Lc] [Payer JSON] 00
        // =========================================================================
        if (cla == CLA_PROPRIETARY && ins == INS_SUBMIT_PAYMENT) {
            int lc = commandApdu.length > 4 ? (commandApdu[4] & 0xFF) : 0;
            if (lc == 0 || commandApdu.length < 5 + lc) {
                Log.w(TAG, "SUBMIT_PAYMENT_TRANSFER failed: missing or truncated payload data");
                return SW_WRONG_LENGTH;
            }

            byte[] payerPayloadBytes = Arrays.copyOfRange(commandApdu, 5, 5 + lc);
            String payerJson = new String(payerPayloadBytes, StandardCharsets.UTF_8);

            // Notify bridge listener of received payment
            HceEventBridge.getInstance().notifyPaymentReceived(payerJson);

            // Respond with compact confirmation: {"status":"CONFIRMED"} + 90 00
            byte[] confirmationBytes = "{\"status\":\"CONFIRMED\"}".getBytes(StandardCharsets.UTF_8);
            byte[] response = appendStatusWord(confirmationBytes, SW_SUCCESS);
            Log.i(TAG, "Payment transfer submitted successfully by payer");
            return response;
        }

        // =========================================================================
        // 4. ACK_CONFIRMATION Command: 80 30 00 00 00
        // =========================================================================
        if (cla == CLA_PROPRIETARY && ins == INS_ACK) {
            Log.i(TAG, "ACK_CONFIRMATION received from reader");
            return SW_SUCCESS;
        }

        // Unsupported CLA or INS
        if (cla != CLA_PROPRIETARY) {
            Log.w(TAG, "Unsupported CLA byte: " + String.format("0x%02X", cla));
            return SW_CLA_NOT_SUPPORTED;
        }

        Log.w(TAG, "Unsupported INS byte: " + String.format("0x%02X", ins));
        return SW_INS_NOT_SUPPORTED;
    }

    @Override
    public void onDeactivated(int reason) {
        Log.i(TAG, "HCE Service Deactivated. Reason: " + 
            (reason == DEACTIVATION_LINK_LOSS ? "LINK_LOSS" : "DESELECTED"));
        isAidSelected = false;
        Arrays.fill(sessionNonce, (byte)0);
        HceEventBridge.getInstance().notifyDeactivated(reason);
    }

    /**
     * Helper to append 2-byte Status Word (SW1 SW2) to response data.
     */
    private static byte[] appendStatusWord(byte[] data, byte[] sw) {
        byte[] result = new byte[data.length + sw.length];
        System.arraycopy(data, 0, result, 0, data.length);
        System.arraycopy(sw, 0, result, data.length, sw.length);
        return result;
    }
}
