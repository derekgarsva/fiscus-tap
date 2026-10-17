package com.fiscus.tap.plugin;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * FiscusNfcPlugin is the official Capacitor Android plugin bridge for Fiscus Tap.
 * Bridges Next.js TypeScript web application to native Android HCE and IsoDep Reader Mode.
 */
@CapacitorPlugin(name = "FiscusNfc")
public class FiscusNfcPlugin extends Plugin {

    private static final String TAG = "FiscusNfcPlugin";

    /**
     * Internal listener bridging HceEventBridge hardware events to Capacitor notifyListeners().
     */
    private final HceEventListener bridgeListener = new HceEventListener() {
        @Override
        public void onHceSessionStarted(String sessionId) {
            JSObject data = new JSObject();
            data.put("sessionId", sessionId);
            notifyListeners("onHceSessionStarted", data);
            notifyListeners("hceSessionStarted", data);
        }

        @Override
        public void onHceAidSelected(String aid, byte[] sessionNonce) {
            JSObject data = new JSObject();
            data.put("aid", aid);
            data.put("sessionNonce", ApduProtocol.bytesToHex(sessionNonce));
            notifyListeners("onHceAidSelected", data);
        }

        @Override
        public void onHcePayloadSent(String sessionId, long timestamp, int bytesTransferred) {
            JSObject data = new JSObject();
            data.put("sessionId", sessionId);
            data.put("timestamp", timestamp);
            data.put("bytesTransferred", bytesTransferred);
            notifyListeners("onHcePayloadSent", data);
            notifyListeners("hcePayloadSent", data);
        }

        @Override
        public void onHcePaymentReceived(String payerPayloadJson) {
            JSObject data = new JSObject();
            try {
                JSONObject obj = new JSONObject(payerPayloadJson);
                data.put("payerPayload", JSObject.fromJSONObject(obj));
            } catch (JSONException e) {
                data.put("payerPayload", payerPayloadJson);
            }
            data.put("rawPayload", payerPayloadJson);
            notifyListeners("onHcePaymentReceived", data);
        }

        @Override
        public void onHceDeactivated(int reason) {
            JSObject data = new JSObject();
            data.put("reason", reason);
            data.put("reasonText", reason == 0 ? "LINK_LOSS" : "DESELECTED");
            notifyListeners("onHceDeactivated", data);
            notifyListeners("hceSessionDeactivated", data);
        }

        @Override
        public void onHceError(String errorCode, String errorMessage) {
            JSObject data = new JSObject();
            data.put("code", errorCode);
            data.put("message", errorMessage);
            notifyListeners("onHceError", data);
        }

        @Override
        public void onTagDiscovered(String jsonPayload) {
            JSObject data = new JSObject();
            try {
                JSONObject obj = new JSONObject(jsonPayload);
                data.put("payload", JSObject.fromJSONObject(obj));
                if (obj.has("sessionId")) data.put("sessionId", obj.optString("sessionId"));
                if (obj.has("amount")) data.put("amount", obj.optDouble("amount"));
                if (obj.has("currency")) data.put("currency", obj.optString("currency"));
                if (obj.has("merchantName")) data.put("merchantName", obj.optString("merchantName"));
                if (obj.has("merchantPhone")) data.put("merchantPhone", obj.optString("merchantPhone"));
                if (obj.has("userId")) data.put("userId", obj.optString("userId"));
                if (obj.has("bankCode")) data.put("bankCode", obj.optString("bankCode"));
                if (obj.has("isPhysicalCard")) data.put("isPhysicalCard", obj.optBoolean("isPhysicalCard"));
                if (obj.has("cardBrand")) data.put("cardBrand", obj.optString("cardBrand"));
                if (obj.has("cardType")) data.put("cardType", obj.optString("cardType"));
                if (obj.has("maskedPan")) data.put("maskedPan", obj.optString("maskedPan"));
                if (obj.has("cardUid")) data.put("cardUid", obj.optString("cardUid"));
                if (obj.has("type")) data.put("type", obj.optString("type"));
                Log.i(TAG, "onTagDiscovered unpacked: isCard=" + obj.optBoolean("isPhysicalCard") + ", brand=" + obj.optString("cardBrand") + ", sessionId=" + obj.optString("sessionId") + ", amount=" + obj.optDouble("amount"));
            } catch (JSONException e) {
                Log.w(TAG, "onTagDiscovered JSONException: " + e.getMessage());
                data.put("payload", jsonPayload);
            }
            data.put("rawPayload", jsonPayload);
            notifyListeners("onTagDiscovered", data);
            notifyListeners("nfcTagDiscovered", data);
        }

        @Override
        public void onReaderError(String errorCode, String errorMessage) {
            JSObject data = new JSObject();
            data.put("code", errorCode);
            data.put("message", errorMessage);
            notifyListeners("onReaderError", data);
            notifyListeners("readerError", data);
        }
    };

    // =========================================================================
    // Plugin Lifecycle Hooks
    // =========================================================================

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "Loading FiscusNfcPlugin: registering HceEventBridge listener");
        HceEventBridge.getInstance().addListener(this.bridgeListener);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        Log.d(TAG, "handleOnResume: evaluating active HCE session priority");
        if (HceEventBridge.getInstance().isSessionArmed()) {
            Activity activity = getActivity();
            if (activity != null) {
                HceEventBridge.enableForegroundPriority(activity);
            }
        }
    }

    @Override
    protected void handleOnPause() {
        Log.d(TAG, "handleOnPause: releasing foreground priority");
        Activity activity = getActivity();
        if (activity != null) {
            HceEventBridge.disableForegroundPriority(activity);
        }
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        Log.i(TAG, "handleOnDestroy: cleaning up FiscusNfcPlugin resources");
        HceEventBridge.getInstance().removeListener(this.bridgeListener);

        Activity activity = getActivity();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (activity != null && adapter != null) {
            FiscusReaderCallback.stop(activity, adapter);
        }

        HceEventBridge.getInstance().clearActiveSession();
        if (activity != null) {
            HceEventBridge.disableForegroundPriority(activity);
        }

        super.handleOnDestroy();
    }

    // =========================================================================
    // Plugin Methods (@PluginMethod)
    // =========================================================================

    /**
     * Checks whether NFC and HCE are supported and enabled on the device.
     */
    @PluginMethod
    public void isSupported(PluginCall call) {
        Context context = getContext();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(context);

        boolean supported = (adapter != null);
        boolean enabled = (adapter != null && adapter.isEnabled());
        boolean hceSupported = context.getPackageManager().hasSystemFeature(
            PackageManager.FEATURE_NFC_HOST_CARD_EMULATION
        );

        JSObject ret = new JSObject();
        ret.put("supported", supported);
        ret.put("enabled", enabled);
        ret.put("hceSupported", hceSupported);

        Log.d(TAG, "isSupported result: supported=" + supported + ", enabled=" + enabled + ", hce=" + hceSupported);
        call.resolve(ret);
    }

    /**
     * Opens Android System NFC Settings.
     */
    @PluginMethod
    public void openNfcSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available", "ACTIVITY_UNAVAILABLE");
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_NFC_SETTINGS);
            activity.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (ActivityNotFoundException anfe) {
            Log.w(TAG, "ACTION_NFC_SETTINGS not found, trying WIRELESS_SETTINGS fallback", anfe);
            try {
                Intent fallback = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
                activity.startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to open wireless settings fallback", e);
                call.reject("Unable to open NFC settings: " + e.getMessage(), "CANNOT_OPEN_SETTINGS");
            }
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error opening NFC settings", e);
            call.reject("Unable to open NFC settings: " + e.getMessage(), "CANNOT_OPEN_SETTINGS");
        }
    }

    /**
     * Arms an active HCE charge session and sets foreground priority.
     */
    @PluginMethod
    public void startHceSession(PluginCall call) {
        Context context = getContext();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(context);

        if (adapter == null) {
            call.reject("NFC hardware is not supported on this device", "NFC_NOT_SUPPORTED");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC is disabled in system settings", "NFC_DISABLED");
            return;
        }

        // Extract session ID
        String sessionId = call.getString("sessionId");
        JSObject nestedPayload = call.getObject("payload");
        if ((sessionId == null || sessionId.trim().isEmpty()) && nestedPayload != null) {
            sessionId = nestedPayload.getString("sessionId");
        }
        if (sessionId == null || sessionId.trim().isEmpty()) {
            sessionId = "cs_" + System.currentTimeMillis();
        }

        // Determine JSON payload string
        String payloadJson;
        if (nestedPayload != null) {
            payloadJson = nestedPayload.toString();
        } else {
            payloadJson = call.getData().toString();
        }

        if (payloadJson == null || payloadJson.trim().isEmpty() || payloadJson.equals("{}")) {
            call.reject("Charge session payload cannot be empty", "PAYLOAD_EMPTY");
            return;
        }

        byte[] payloadBytes = payloadJson.getBytes(StandardCharsets.UTF_8);

        // Enforce ISO 7816-4 Short APDU limit (< 240 bytes)
        if (payloadBytes.length > ApduProtocol.MAX_SHORT_APDU_PAYLOAD) {
            call.reject(
                "Payload exceeds Short APDU maximum limit of 240 bytes (actual: " + payloadBytes.length + " bytes)",
                "PAYLOAD_TOO_LARGE"
            );
            return;
        }

        // Arm session in in-process bridge
        HceEventBridge.getInstance().setActiveSession(sessionId, payloadBytes);

        // Enforce OS foreground priority
        Activity activity = getActivity();
        boolean priorityGranted = false;
        if (activity != null) {
            priorityGranted = HceEventBridge.enableForegroundPriority(activity);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("sessionId", sessionId);
        ret.put("priorityGranted", priorityGranted);
        ret.put("bytesTransferred", payloadBytes.length);

        Log.i(TAG, "HCE session armed: id=" + sessionId + ", bytes=" + payloadBytes.length + ", priority=" + priorityGranted);
        call.resolve(ret);
    }

    /**
     * Disarms the active HCE session and unsets foreground priority.
     */
    @PluginMethod
    public void stopHceSession(PluginCall call) {
        HceEventBridge.getInstance().clearActiveSession();

        Activity activity = getActivity();
        if (activity != null) {
            HceEventBridge.disableForegroundPriority(activity);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        Log.i(TAG, "HCE session stopped and disarmed");
        call.resolve(ret);
    }

    /**
     * Enables Android Reader Mode for reading HCE tags with IsoDep.
     */
    @PluginMethod
    public void startReaderMode(PluginCall call) {
        Context context = getContext();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(context);

        if (adapter == null) {
            call.reject("NFC hardware is not supported on this device", "NFC_NOT_SUPPORTED");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC is disabled in system settings", "NFC_DISABLED");
            return;
        }

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            call.reject("Host Activity is unavailable", "ACTIVITY_UNAVAILABLE");
            return;
        }

        final int timeoutMs = call.getInt("timeoutMs", FiscusReaderCallback.DEFAULT_TIMEOUT_MS);

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    FiscusReaderCallback.start(activity, adapter, timeoutMs);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("timeoutMs", timeoutMs);
                    Log.i(TAG, "Reader Mode started with timeout: " + timeoutMs + "ms");
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to start Reader Mode", e);
                    call.reject("Failed to enable Reader Mode: " + e.getMessage(), "READER_MODE_FAILED");
                }
            }
        });
    }

    /**
     * Disables Android Reader Mode.
     */
    @PluginMethod
    public void stopReaderMode(PluginCall call) {
        Activity activity = getActivity();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());

        if (activity != null && adapter != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        FiscusReaderCallback.stop(activity, adapter);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        Log.i(TAG, "Reader Mode stopped");
                        call.resolve(ret);
                    } catch (Exception e) {
                        Log.w(TAG, "Error stopping Reader Mode", e);
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", e.getMessage());
                        call.resolve(ret);
                    }
                }
            });
        } else {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }
    }
}
