package com.fiscus.tap.plugin;

/**
 * Abstract adapter class with default no-op implementations for HceEventListener.
 */
public abstract class HceEventAdapter implements HceEventListener {
    @Override public void onHceSessionStarted(String sessionId) {}
    @Override public void onHceAidSelected(String aid, byte[] sessionNonce) {}
    @Override public void onHcePayloadSent(String sessionId, long timestamp, int bytesTransferred) {}
    @Override public void onHcePaymentReceived(String payerPayloadJson) {}
    @Override public void onHceDeactivated(int reason) {}
    @Override public void onHceError(String errorCode, String errorMessage) {}
    @Override public void onTagDiscovered(String jsonPayload) {}
    @Override public void onReaderError(String errorCode, String errorMessage) {}
}
