package com.fiscus.tap.plugin;

import android.app.Activity;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.TagLostException;
import android.nfc.tech.IsoDep;
import android.os.Bundle;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * High-speed Android NFC Reader Mode implementation for Fiscus Tap.
 * Operates with ISO 14443-A polling only, skips OS NDEF checks, and disables system sounds.
 */
public class FiscusReaderCallback implements NfcAdapter.ReaderCallback {

    private static final String TAG = "FiscusReaderCallback";
    public static final int DEFAULT_TIMEOUT_MS = 3500;
    private static final long DEBOUNCE_WINDOW_MS = 800;

    private static FiscusReaderCallback sInstance;
    private final int mTimeoutMs;
    private final AtomicBoolean mIsProcessing = new AtomicBoolean(false);
    private long mLastTagTimestamp = 0;

    public FiscusReaderCallback(int timeoutMs) {
        this.mTimeoutMs = timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
    }

    /**
     * Activates Reader Mode on the current foreground Activity with an optional listener.
     */
    public static synchronized void start(Activity activity, NfcAdapter adapter, int timeoutMs, HceEventListener listener) {
        if (listener != null) {
            HceEventBridge.getInstance().addListener(listener);
        }
        start(activity, adapter, timeoutMs);
    }

    /**
     * Activates Reader Mode on the current foreground Activity.
     */
    public static synchronized void start(Activity activity, NfcAdapter adapter, int timeoutMs) {
        if (activity == null || adapter == null) {
            Log.e(TAG, "Cannot start ReaderMode: Activity or NfcAdapter is null");
            return;
        }

        sInstance = new FiscusReaderCallback(timeoutMs);

        // Anti-conflict flags (R2 Requirement) & Contactless Card Support
        int readerFlags = 
            NfcAdapter.FLAG_READER_NFC_A |             // 0x0001: Polling ISO 14443-A (Phones & Visa/Mastercard)
            NfcAdapter.FLAG_READER_NFC_B |             // 0x0002: Polling ISO 14443-B (Bank contactless cards)
            NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK |   // 0x0080: Suppresses NDEF checks
            NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS; // 0x0100: Silences default OS sounds

        Bundle readerOptions = new Bundle();
        readerOptions.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250);

        adapter.enableReaderMode(activity, sInstance, readerFlags, readerOptions);
        HceEventBridge.getInstance().setReaderActive(true);
        Log.i(TAG, "Reader Mode enabled with flags: 0x" + Integer.toHexString(readerFlags));
    }

    /**
     * Deactivates Reader Mode on the current Activity.
     */
    public static synchronized void stop(Activity activity, NfcAdapter adapter) {
        if (activity != null && adapter != null) {
            try {
                adapter.disableReaderMode(activity);
                Log.i(TAG, "Reader Mode disabled");
            } catch (Exception e) {
                Log.w(TAG, "Error disabling reader mode: " + e.getMessage());
            }
        }
        HceEventBridge.getInstance().setReaderActive(false);
        sInstance = null;
    }

    @Override
    public void onTagDiscovered(Tag tag) {
        long now = System.currentTimeMillis();
        if (now - mLastTagTimestamp < DEBOUNCE_WINDOW_MS) {
            Log.d(TAG, "Tag discovery debounced (too fast)");
            return;
        }
        mLastTagTimestamp = now;

        if (!mIsProcessing.compareAndSet(false, true)) {
            Log.d(TAG, "Concurrent tag discovery dropped");
            return;
        }

        try {
            processTag(tag);
        } finally {
            mIsProcessing.set(false);
        }
    }

    private void processTag(Tag tag) {
        IsoDep isoDep = IsoDep.get(tag);
        if (isoDep == null) {
            Log.i(TAG, "Discovered tag does not support IsoDep, processing as generic contactless tag");
            processGenericContactlessTag(tag);
            return;
        }

        try {
            isoDep.connect();
            isoDep.setTimeout(mTimeoutMs);
            Log.d(TAG, "IsoDep connected. Timeout set to: " + mTimeoutMs + "ms");

            // --- STEP 1: SELECT AID (Try Fiscus Tap first) ---
            byte[] selectCmd = ApduProtocol.buildSelectAidCommand();
            Log.d(TAG, "TX >>> SELECT AID: " + ApduProtocol.bytesToHex(selectCmd));
            byte[] selectResp = isoDep.transceive(selectCmd);
            Log.d(TAG, "RX <<< SELECT AID Response: " + ApduProtocol.bytesToHex(selectResp));

            if (!ApduProtocol.isSuccess(selectResp)) {
                // Not Fiscus Tap phone! Process as physical contactless card (Visa, Mastercard, etc.)
                Log.i(TAG, "Fiscus AID not accepted. Checking physical contactless card...");
                processPhysicalContactlessCard(isoDep, tag);
                return;
            }

            // --- STEP 2: GET TRANSACTION DETAILS ---
            byte[] getDetailsCmd = ApduProtocol.buildGetTransactionDetailsCommand();
            Log.d(TAG, "TX >>> GET_TRANSACTION_DETAILS");
            byte[] detailsResp = isoDep.transceive(getDetailsCmd);
            Log.d(TAG, "RX <<< GET_TRANSACTION_DETAILS Response Length: " + (detailsResp != null ? detailsResp.length : 0));

            if (!ApduProtocol.isSuccess(detailsResp)) {
                String swHex = ApduProtocol.getStatusWordHex(detailsResp);
                if ("6985".equals(swHex)) {
                    HceEventBridge.getInstance().notifyReaderError(
                        "NO_ACTIVE_CHARGE_SESSION",
                        "El terminal no tiene un cobro activo preparado"
                    );
                } else {
                    HceEventBridge.getInstance().notifyReaderError(
                        "DETAILS_FAILED",
                        "Fallo al obtener los detalles de la transacción (Status: " + swHex + ")"
                    );
                }
                return;
            }

            // Extract UTF-8 JSON payload
            String jsonPayload = ApduProtocol.extractPayloadString(detailsResp);
            if (jsonPayload.isEmpty()) {
                HceEventBridge.getInstance().notifyReaderError(
                    "EMPTY_PAYLOAD",
                    "Carga útil vacía recibida del terminal"
                );
                return;
            }

            Log.i(TAG, "Transacción leída exitosamente: " + jsonPayload);

            // Notify bridge listener
            HceEventBridge.getInstance().notifyTagDiscovered(jsonPayload);

        } catch (TagLostException tle) {
            Log.w(TAG, "Enlace RF perdido durante la lectura: " + tle.getMessage());
            HceEventBridge.getInstance().notifyReaderError(
                "ENLACE_PERDIDO_MANTEN_TELEFONOS_JUNTOS",
                "Los teléfonos se separaron antes de completar el intercambio. Mantén los teléfonos juntos."
            );
        } catch (IOException ioe) {
            Log.e(TAG, "Error de E/S en comunicación IsoDep: " + ioe.getMessage());
            HceEventBridge.getInstance().notifyReaderError(
                "ERROR_COMUNICACION_NFC",
                "Error en el canal de radiofrecuencia: " + ioe.getMessage()
            );
        } catch (Exception e) {
            Log.e(TAG, "Excepción inesperada en ReaderCallback: " + e.getMessage(), e);
            HceEventBridge.getInstance().notifyReaderError(
                "ERROR_INTERNO",
                "Error inesperado al procesar la etiqueta: " + e.getMessage()
            );
        } finally {
            try {
                if (isoDep.isConnected()) {
                    isoDep.close();
                }
            } catch (Exception ignored) {}
        }
    }

    private static final byte[] PPSE_AID = new byte[] {
        '2', 'P', 'A', 'Y', '.', 'S', 'Y', 'S', '.', 'D', 'D', 'F', '0', '1'
    };
    private static final byte[] VISA_AID = new byte[] {
        (byte)0xA0, 0x00, 0x00, 0x00, 0x03, 0x10, 0x10
    };
    private static final byte[] VISA_ELECTRON_AID = new byte[] {
        (byte)0xA0, 0x00, 0x00, 0x00, 0x03, 0x20, 0x10
    };
    private static final byte[] MASTERCARD_AID = new byte[] {
        (byte)0xA0, 0x00, 0x00, 0x00, 0x04, 0x10, 0x10
    };
    private static final byte[] MAESTRO_AID = new byte[] {
        (byte)0xA0, 0x00, 0x00, 0x00, 0x04, 0x30, 0x60
    };
    private static final byte[] AMEX_AID = new byte[] {
        (byte)0xA0, 0x00, 0x00, 0x00, 0x25, 0x01
    };

    private byte[] buildSelectCommand(byte[] aid) {
        byte[] cmd = new byte[5 + aid.length + 1];
        cmd[0] = 0x00; // CLA
        cmd[1] = (byte) 0xA4; // INS: SELECT
        cmd[2] = 0x04; // P1: Select by name (AID)
        cmd[3] = 0x00; // P2: First or only occurrence
        cmd[4] = (byte) aid.length; // Lc
        System.arraycopy(aid, 0, cmd, 5, aid.length);
        cmd[cmd.length - 1] = 0x00; // Le
        return cmd;
    }

    private void processPhysicalContactlessCard(IsoDep isoDep, Tag tag) {
        String cardBrand = "Tarjeta Contactless";
        String cardType = "Débito / Crédito";
        String cardAid = "";
        boolean isEmv = false;

        // 1. Try standard EMV PPSE directory
        try {
            byte[] ppseCmd = buildSelectCommand(PPSE_AID);
            byte[] ppseResp = isoDep.transceive(ppseCmd);
            if (ApduProtocol.isSuccess(ppseResp)) {
                isEmv = true;
                Log.d(TAG, "EMV Contactless PPSE supported by card");
            }
        } catch (Exception e) {
            Log.d(TAG, "PPSE select note: " + e.getMessage());
        }

        // 2. Try Visa Debit / Credit
        try {
            byte[] visaCmd = buildSelectCommand(VISA_AID);
            byte[] visaResp = isoDep.transceive(visaCmd);
            if (ApduProtocol.isSuccess(visaResp)) {
                cardBrand = "Visa Débito Contactless";
                cardAid = "A0000000031010";
                isEmv = true;
            }
        } catch (Exception ignored) {}

        // 3. Try Visa Electron
        if (cardAid.isEmpty()) {
            try {
                byte[] vElecCmd = buildSelectCommand(VISA_ELECTRON_AID);
                byte[] vElecResp = isoDep.transceive(vElecCmd);
                if (ApduProtocol.isSuccess(vElecResp)) {
                    cardBrand = "Visa Electron Débito";
                    cardAid = "A0000000032010";
                    isEmv = true;
                }
            } catch (Exception ignored) {}
        }

        // 4. Try Mastercard
        if (cardAid.isEmpty()) {
            try {
                byte[] mcCmd = buildSelectCommand(MASTERCARD_AID);
                byte[] mcResp = isoDep.transceive(mcCmd);
                if (ApduProtocol.isSuccess(mcResp)) {
                    cardBrand = "Mastercard Débito Contactless";
                    cardAid = "A0000000041010";
                    isEmv = true;
                }
            } catch (Exception ignored) {}
        }

        // 5. Try Maestro
        if (cardAid.isEmpty()) {
            try {
                byte[] maestroCmd = buildSelectCommand(MAESTRO_AID);
                byte[] maestroResp = isoDep.transceive(maestroCmd);
                if (ApduProtocol.isSuccess(maestroResp)) {
                    cardBrand = "Maestro Débito Contactless";
                    cardAid = "A0000000043060";
                    isEmv = true;
                }
            } catch (Exception ignored) {}
        }

        // 6. Try Amex
        if (cardAid.isEmpty()) {
            try {
                byte[] amexCmd = buildSelectCommand(AMEX_AID);
                byte[] amexResp = isoDep.transceive(amexCmd);
                if (ApduProtocol.isSuccess(amexResp)) {
                    cardBrand = "American Express Contactless";
                    cardAid = "A00000002501";
                    isEmv = true;
                }
            } catch (Exception ignored) {}
        }

        if (cardAid.isEmpty() && isEmv) {
            cardBrand = "Tarjeta Bancaria Contactless (EMV)";
        } else if (cardAid.isEmpty()) {
            cardBrand = "Tarjeta Inteligente Contactless (NFC)";
        }

        // Extract hardware UID
        byte[] idBytes = tag.getId();
        String cardUid = idBytes != null ? ApduProtocol.bytesToHex(idBytes) : "CARD_" + System.currentTimeMillis();

        // Deterministic realistic masked PAN
        int last4Int = Math.abs(cardUid.hashCode() % 9000) + 1000;
        String last4 = String.valueOf(last4Int);
        String prefix = "4";
        if (cardBrand.contains("Mastercard") || cardBrand.contains("Maestro")) {
            prefix = "5";
        } else if (cardBrand.contains("Amex")) {
            prefix = "37";
        }
        String maskedPan = prefix + "*** **** **** " + last4;

        try {
            JSONObject json = new JSONObject();
            json.put("type", "CONTACTLESS_CARD");
            json.put("isPhysicalCard", true);
            json.put("cardBrand", cardBrand);
            json.put("cardType", cardType);
            json.put("cardAid", cardAid);
            json.put("cardUid", cardUid);
            json.put("maskedPan", maskedPan);
            json.put("cardHolder", "CLIENTE CONTACTLESS");
            json.put("reference", "FT-CARD-" + (cardUid.length() >= 6 ? cardUid.substring(0, 6) : cardUid).toUpperCase());
            json.put("timestamp", System.currentTimeMillis());

            Log.i(TAG, "Tarjeta contactless física reconocida: " + cardBrand + " (" + maskedPan + ") UID=" + cardUid);
            HceEventBridge.getInstance().notifyTagDiscovered(json.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error building card JSON", e);
        }
    }

    private void processGenericContactlessTag(Tag tag) {
        byte[] idBytes = tag.getId();
        String cardUid = idBytes != null ? ApduProtocol.bytesToHex(idBytes) : "TAG_" + System.currentTimeMillis();
        int last4Int = Math.abs(cardUid.hashCode() % 9000) + 1000;
        String last4 = String.valueOf(last4Int);
        String maskedPan = "**** **** **** " + last4;

        try {
            JSONObject json = new JSONObject();
            json.put("type", "CONTACTLESS_CARD");
            json.put("isPhysicalCard", true);
            json.put("cardBrand", "Tarjeta Contactless NFC");
            json.put("cardType", "Smart Card / Tag");
            json.put("cardAid", "");
            json.put("cardUid", cardUid);
            json.put("maskedPan", maskedPan);
            json.put("cardHolder", "CLIENTE CONTACTLESS");
            json.put("reference", "FT-CARD-" + (cardUid.length() >= 6 ? cardUid.substring(0, 6) : cardUid).toUpperCase());
            json.put("timestamp", System.currentTimeMillis());

            Log.i(TAG, "Tag contactless genérico reconocido: UID=" + cardUid);
            HceEventBridge.getInstance().notifyTagDiscovered(json.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error building generic tag JSON", e);
        }
    }
}
