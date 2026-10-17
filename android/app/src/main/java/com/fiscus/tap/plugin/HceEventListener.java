package com.fiscus.tap.plugin;

/**
 * Event listener interface for HCE and NFC Reader hardware events.
 * Implementations are registered with HceEventBridge.
 */
public interface HceEventListener {
    /**
     * Fired when an HCE charge session is armed and ready in memory.
     * @param sessionId Unique session identifier.
     */
    void onHceSessionStarted(String sessionId);

    /**
     * Fired when an external reader sends SELECT AID matching Fiscus Tap.
     * @param aid Canonical AID (e.g. F046495343555301).
     * @param sessionNonce 8-byte cryptographic session nonce.
     */
    void onHceAidSelected(String aid, byte[] sessionNonce);

    /**
     * Fired when FiscusHceService successfully returns the charge payload via GET_TRANSACTION_DETAILS.
     * @param sessionId Session identifier.
     * @param timestamp System time in milliseconds.
     * @param bytesTransferred Number of bytes transmitted over RF.
     */
    void onHcePayloadSent(String sessionId, long timestamp, int bytesTransferred);

    /**
     * Fired when FiscusHceService receives payment confirmation (SUBMIT_PAYMENT_TRANSFER).
     * @param payerPayloadJson Raw JSON string received from payer.
     */
    void onHcePaymentReceived(String payerPayloadJson);

    /**
     * Fired when HCE service is deactivated by NFC controller.
     * @param reason Deactivation reason (0 = DEACTIVATION_LINK_LOSS, 1 = DEACTIVATION_DESELECTED).
     */
    void onHceDeactivated(int reason);

    /**
     * Fired when an internal error occurs within the HCE service.
     * @param errorCode Machine-readable error code.
     * @param errorMessage Descriptive error message.
     */
    void onHceError(String errorCode, String errorMessage);

    /**
     * Fired by FiscusReaderCallback when an HCE target tag is discovered and details read.
     * @param jsonPayload Serialized transaction details read from the target phone.
     */
    void onTagDiscovered(String jsonPayload);

    /**
     * Fired by FiscusReaderCallback when tag reading fails or link is lost.
     * @param errorCode Error code (e.g., TAG_LOST, AID_REJECTED, TIMEOUT).
     * @param errorMessage Human-readable error message.
     */
    void onReaderError(String errorCode, String errorMessage);
}
