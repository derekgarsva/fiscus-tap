package com.fiscus.tap.plugin;

import android.app.Activity;
import android.content.ComponentName;
import android.nfc.NfcAdapter;
import android.nfc.cardemulation.CardEmulation;
import android.util.Log;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * In-process, thread-safe singleton event bus connecting FiscusHceService,
 * FiscusReaderCallback, and FiscusNfcPlugin.
 */
public final class HceEventBridge {

    private static final String TAG = "HceEventBridge";
    private static final HceEventBridge INSTANCE = new HceEventBridge();

    public static HceEventBridge getInstance() {
        return INSTANCE;
    }

    private final List<HceEventListener> listeners = new CopyOnWriteArrayList<>();
    private final AtomicReference<byte[]> activePayload = new AtomicReference<>(null);
    private final AtomicReference<String> activeSessionId = new AtomicReference<>(null);
    private final AtomicBoolean isHceArmed = new AtomicBoolean(false);
    private final AtomicBoolean isReaderActive = new AtomicBoolean(false);

    private HceEventBridge() {
        // Enforce singleton
    }

    // =========================================================================
    // Session State Management (Called by FiscusNfcPlugin)
    // =========================================================================

    /**
     * Arms the HCE service with an active session payload.
     * Defensive copy is performed on the incoming byte array.
     */
    public void setActiveSession(String sessionId, byte[] payload) {
        if (sessionId == null || payload == null || payload.length == 0) {
            throw new IllegalArgumentException("Session ID and payload must not be null or empty");
        }
        this.activeSessionId.set(sessionId);
        this.activePayload.set(payload.clone());
        this.isHceArmed.set(true);

        Log.d(TAG, "Active HCE session armed: id=" + sessionId + ", bytes=" + payload.length);
        for (HceEventListener l : listeners) {
            try {
                l.onHceSessionStarted(sessionId);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onHceSessionStarted listener", t);
            }
        }
    }

    /**
     * Clears the active session and disarms HCE response state.
     */
    public void clearActiveSession() {
        String prevSession = this.activeSessionId.getAndSet(null);
        this.activePayload.set(null);
        this.isHceArmed.set(false);
        Log.d(TAG, "Active HCE session cleared: prev=" + prevSession);
    }

    /**
     * Retrieves the current payload for the HCE service.
     * Returns a defensive clone to protect internal state.
     */
    public byte[] getActivePayload() {
        byte[] payload = this.activePayload.get();
        return (payload != null) ? payload.clone() : null;
    }

    /**
     * Returns the active session ID.
     */
    public String getActiveSessionId() {
        return this.activeSessionId.get();
    }

    /**
     * Checks if an HCE session is currently armed.
     */
    public boolean isSessionArmed() {
        return this.isHceArmed.get();
    }

    /**
     * Sets whether the NFC Reader mode is currently active.
     */
    public void setReaderActive(boolean active) {
        this.isReaderActive.set(active);
    }

    /**
     * Checks if reader mode is active.
     */
    public boolean isReaderActive() {
        return this.isReaderActive.get();
    }

    // =========================================================================
    // Listener Registration
    // =========================================================================

    public void addListener(HceEventListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(HceEventListener listener) {
        if (listener != null) {
            listeners.remove(listener);
        }
    }

    public void clearListeners() {
        listeners.clear();
    }

    // =========================================================================
    // Notification Dispatchers (Called by FiscusHceService & FiscusReaderCallback)
    // =========================================================================

    public void notifyAidSelected(String aid, byte[] nonce) {
        byte[] safeNonce = (nonce != null) ? nonce.clone() : new byte[0];
        for (HceEventListener l : listeners) {
            try {
                l.onHceAidSelected(aid, safeNonce);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onHceAidSelected listener", t);
            }
        }
    }

    public void notifyPayloadSent(int bytesTransferred) {
        String sid = activeSessionId.get();
        long now = System.currentTimeMillis();
        for (HceEventListener l : listeners) {
            try {
                l.onHcePayloadSent(sid, now, bytesTransferred);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onHcePayloadSent listener", t);
            }
        }
    }

    public void notifyPaymentReceived(String payerJson) {
        for (HceEventListener l : listeners) {
            try {
                l.onHcePaymentReceived(payerJson);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onHcePaymentReceived listener", t);
            }
        }
    }

    public void notifyDeactivated(int reason) {
        for (HceEventListener l : listeners) {
            try {
                l.onHceDeactivated(reason);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onHceDeactivated listener", t);
            }
        }
    }

    public void notifyHceError(String code, String message) {
        for (HceEventListener l : listeners) {
            try {
                l.onHceError(code, message);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onHceError listener", t);
            }
        }
    }

    public void notifyTagDiscovered(String jsonPayload) {
        for (HceEventListener l : listeners) {
            try {
                l.onTagDiscovered(jsonPayload);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onTagDiscovered listener", t);
            }
        }
    }

    public void notifyReaderError(String code, String message) {
        for (HceEventListener l : listeners) {
            try {
                l.onReaderError(code, message);
            } catch (Throwable t) {
                Log.e(TAG, "Error in onReaderError listener", t);
            }
        }
    }

    // =========================================================================
    // Foreground Priority & OS Conflict Gating Helpers
    // =========================================================================

    /**
     * Enforces foreground priority for FiscusHceService using CardEmulation.
     * Prevents Android OS conflict dialogs and default wallet selection.
     *
     * @param activity The active foreground Activity.
     * @return true if preferred service was successfully granted by Android.
     */
    public static boolean enableForegroundPriority(Activity activity) {
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            Log.w(TAG, "Cannot enable foreground priority: invalid activity");
            return false;
        }
        try {
            NfcAdapter adapter = NfcAdapter.getDefaultAdapter(activity);
            if (adapter == null || !adapter.isEnabled()) {
                Log.w(TAG, "NFC adapter not available or disabled");
                return false;
            }
            CardEmulation cardEmulation = CardEmulation.getInstance(adapter);
            ComponentName serviceComponent = new ComponentName(activity, FiscusHceService.class);
            boolean success = cardEmulation.setPreferredService(activity, serviceComponent);
            Log.i(TAG, "CardEmulation.setPreferredService granted=" + success);
            return success;
        } catch (Exception e) {
            Log.e(TAG, "Failed to setPreferredService", e);
            return false;
        }
    }

    /**
     * Releases foreground priority for FiscusHceService.
     *
     * @param activity The active foreground Activity.
     * @return true if successfully unset.
     */
    public static boolean disableForegroundPriority(Activity activity) {
        if (activity == null) return false;
        try {
            NfcAdapter adapter = NfcAdapter.getDefaultAdapter(activity);
            if (adapter == null) return false;
            CardEmulation cardEmulation = CardEmulation.getInstance(adapter);
            boolean success = cardEmulation.unsetPreferredService(activity);
            Log.i(TAG, "CardEmulation.unsetPreferredService success=" + success);
            return success;
        } catch (Exception e) {
            Log.e(TAG, "Failed to unsetPreferredService", e);
            return false;
        }
    }
}
