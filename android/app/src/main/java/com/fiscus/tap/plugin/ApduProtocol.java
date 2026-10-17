package com.fiscus.tap.plugin;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * ISO/IEC 7816-4 Short APDU protocol specification and serializer for Fiscus Tap.
 * Enforces strict 240-byte maximum payload limits to avoid extended APDU incompatibilities.
 */
public final class ApduProtocol {

    private ApduProtocol() {}

    // Classes (CLA)
    public static final byte CLA_ISO = (byte) 0x00;
    public static final byte CLA_PROPRIETARY = (byte) 0x80;

    // Instructions (INS)
    public static final byte INS_SELECT = (byte) 0xA4;
    public static final byte INS_GET_TRANSACTION_DETAILS = (byte) 0x10;
    public static final byte INS_SUBMIT_PAYMENT_TRANSFER = (byte) 0x20;
    public static final byte INS_ACK_CONFIRMATION = (byte) 0x30;

    // Parameters (P1, P2)
    public static final byte P1_SELECT_BY_NAME = (byte) 0x04;
    public static final byte P2_FIRST_OCCURRENCE = (byte) 0x00;
    public static final byte P1_DEFAULT = (byte) 0x00;
    public static final byte P2_DEFAULT = (byte) 0x00;

    // Application Identifier (AID)
    public static final byte[] AID_BYTES = new byte[]{
        (byte) 0xF0, (byte) 0x46, (byte) 0x49, (byte) 0x53,
        (byte) 0x43, (byte) 0x55, (byte) 0x53, (byte) 0x01
    };
    public static final String AID_HEX = "F046495343555301";

    // Protocol Version & Roles
    public static final byte PROTOCOL_VERSION = (byte) 0x01;
    public static final byte ROLE_MERCHANT = (byte) 0x01;
    public static final byte ROLE_PAYER = (byte) 0x02;

    // Maximum Short APDU Payload constraint (ISO 7816-4 standard max 255B; 240B safety threshold)
    public static final int MAX_SHORT_APDU_PAYLOAD = 240;

    // Status Words (SW1, SW2)
    public static final byte[] SW_SUCCESS = new byte[]{(byte) 0x90, (byte) 0x00};
    public static final byte[] SW_FILE_NOT_FOUND = new byte[]{(byte) 0x6A, (byte) 0x82};
    public static final byte[] SW_CONDITIONS_NOT_SATISFIED = new byte[]{(byte) 0x69, (byte) 0x85};
    public static final byte[] SW_WRONG_LENGTH = new byte[]{(byte) 0x67, (byte) 0x00};
    public static final byte[] SW_SECURITY_NOT_SATISFIED = new byte[]{(byte) 0x69, (byte) 0x82};
    public static final byte[] SW_INCORRECT_P1P2 = new byte[]{(byte) 0x6A, (byte) 0x86};
    public static final byte[] SW_INS_NOT_SUPPORTED = new byte[]{(byte) 0x6D, (byte) 0x00};
    public static final byte[] SW_CLA_NOT_SUPPORTED = new byte[]{(byte) 0x6E, (byte) 0x00};
    public static final byte[] SW_INTERNAL_ERROR = new byte[]{(byte) 0x6F, (byte) 0x00};

    // --- Command Builders ---

    /**
     * Builds SELECT_AID Command: 00 A4 04 00 08 F0 46 49 53 43 55 53 01 00 (14 bytes)
     */
    public static byte[] buildSelectAidCommand() {
        byte[] cmd = new byte[14];
        cmd[0] = CLA_ISO;
        cmd[1] = INS_SELECT;
        cmd[2] = P1_SELECT_BY_NAME;
        cmd[3] = P2_FIRST_OCCURRENCE;
        cmd[4] = (byte) AID_BYTES.length; // Lc = 8
        System.arraycopy(AID_BYTES, 0, cmd, 5, AID_BYTES.length);
        cmd[13] = (byte) 0x00; // Le
        return cmd;
    }

    /**
     * Builds GET_TRANSACTION_DETAILS Command: 80 10 00 00 00 (5 bytes)
     */
    public static byte[] buildGetTransactionDetailsCommand() {
        return new byte[]{
            CLA_PROPRIETARY,
            INS_GET_TRANSACTION_DETAILS,
            P1_DEFAULT,
            P2_DEFAULT,
            (byte) 0x00 // Le
        };
    }

    /**
     * Builds SUBMIT_PAYMENT_TRANSFER Command: 80 20 00 00 [Lc] [Data] 00
     */
    public static byte[] buildSubmitPaymentTransferCommand(byte[] data) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Payload cannot be empty");
        }
        if (data.length > MAX_SHORT_APDU_PAYLOAD) {
            throw new IllegalArgumentException("Payload exceeds 240 bytes Short APDU limit: " + data.length);
        }
        byte[] cmd = new byte[5 + data.length + 1];
        cmd[0] = CLA_PROPRIETARY;
        cmd[1] = INS_SUBMIT_PAYMENT_TRANSFER;
        cmd[2] = P1_DEFAULT;
        cmd[3] = P2_DEFAULT;
        cmd[4] = (byte) data.length; // Lc
        System.arraycopy(data, 0, cmd, 5, data.length);
        cmd[cmd.length - 1] = (byte) 0x00; // Le
        return cmd;
    }

    /**
     * Builds ACK_CONFIRMATION Command: 80 30 00 00 00 (5 bytes)
     */
    public static byte[] buildAckConfirmationCommand() {
        return new byte[]{
            CLA_PROPRIETARY,
            INS_ACK_CONFIRMATION,
            P1_DEFAULT,
            P2_DEFAULT,
            (byte) 0x00 // Le
        };
    }

    // --- Response Builders ---

    public static byte[] buildSuccessResponse(byte[] data) {
        if (data == null || data.length == 0) {
            return SW_SUCCESS.clone();
        }
        byte[] resp = new byte[data.length + 2];
        System.arraycopy(data, 0, resp, 0, data.length);
        resp[data.length] = SW_SUCCESS[0];
        resp[data.length + 1] = SW_SUCCESS[1];
        return resp;
    }

    public static byte[] buildStatusResponse(byte[] statusWord) {
        if (statusWord == null || statusWord.length != 2) {
            return SW_INTERNAL_ERROR.clone();
        }
        return statusWord.clone();
    }

    public static byte[] buildSelectResponse(byte version, byte role, byte[] nonce) {
        if (nonce == null || nonce.length != 8) {
            throw new IllegalArgumentException("Session nonce must be exactly 8 bytes");
        }
        byte[] resp = new byte[1 + 1 + 8 + 2];
        resp[0] = version;
        resp[1] = role;
        System.arraycopy(nonce, 0, resp, 2, 8);
        resp[10] = SW_SUCCESS[0];
        resp[11] = SW_SUCCESS[1];
        return resp;
    }

    // --- Parsers & Status Word Checkers ---

    public static boolean isSuccess(byte[] responseApdu) {
        if (responseApdu == null || responseApdu.length < 2) return false;
        int len = responseApdu.length;
        return responseApdu[len - 2] == (byte) 0x90 && responseApdu[len - 1] == (byte) 0x00;
    }

    public static int getStatusWord(byte[] responseApdu) {
        if (responseApdu == null || responseApdu.length < 2) return 0;
        int len = responseApdu.length;
        int sw1 = responseApdu[len - 2] & 0xFF;
        int sw2 = responseApdu[len - 1] & 0xFF;
        return (sw1 << 8) | sw2;
    }

    public static String getStatusWordHex(byte[] responseApdu) {
        if (responseApdu == null || responseApdu.length < 2) return "0000";
        int len = responseApdu.length;
        return String.format("%02X%02X", responseApdu[len - 2], responseApdu[len - 1]);
    }

    public static byte[] extractPayload(byte[] responseApdu) {
        if (responseApdu == null || responseApdu.length < 2) return new byte[0];
        return Arrays.copyOfRange(responseApdu, 0, responseApdu.length - 2);
    }

    public static String extractPayloadString(byte[] responseApdu) {
        byte[] payload = extractPayload(responseApdu);
        if (payload.length == 0) return "";
        return new String(payload, StandardCharsets.UTF_8);
    }

    // --- Hex Utilities ---

    public static String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    public static byte[] hexToBytes(String hex) {
        if (hex == null || hex.isEmpty()) return new byte[0];
        String clean = hex.replaceAll("\\s+", "").toUpperCase();
        if (clean.length() % 2 != 0) {
            throw new IllegalArgumentException("Hex string must have an even length");
        }
        int len = clean.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(clean.charAt(i), 16) << 4)
                                 + Character.digit(clean.charAt(i + 1), 16));
        }
        return data;
    }
}
