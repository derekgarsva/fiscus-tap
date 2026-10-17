package com.fiscus.tap;

import android.content.ComponentName;
import android.nfc.NfcAdapter;
import android.nfc.cardemulation.CardEmulation;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.fiscus.tap.plugin.FiscusHceService;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            Class<?> pluginClass = Class.forName("com.fiscus.tap.plugin.FiscusNfcPlugin");
            if (com.getcapacitor.Plugin.class.isAssignableFrom(pluginClass)) {
                @SuppressWarnings("unchecked")
                Class<? extends com.getcapacitor.Plugin> typedPlugin = 
                    (Class<? extends com.getcapacitor.Plugin>) pluginClass;
                registerPlugin(typedPlugin);
                Log.i(TAG, "Registered in-repo plugin: FiscusNfcPlugin");
            }
        } catch (ClassNotFoundException ignored) {
            // FiscusNfcPlugin will be linked in Milestone 2
        }
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            NfcAdapter adapter = NfcAdapter.getDefaultAdapter(this);
            if (adapter != null && adapter.isEnabled()) {
                CardEmulation cardEmulation = CardEmulation.getInstance(adapter);
                ComponentName component = new ComponentName(this, FiscusHceService.class);
                boolean success = cardEmulation.setPreferredService(this, component);
                Log.i(TAG, "CardEmulation.setPreferredService onResume success: " + success);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to setPreferredService in onResume: " + e.getMessage());
        }
    }

    @Override
    public void onPause() {
        try {
            NfcAdapter adapter = NfcAdapter.getDefaultAdapter(this);
            if (adapter != null) {
                CardEmulation cardEmulation = CardEmulation.getInstance(adapter);
                boolean success = cardEmulation.unsetPreferredService(this);
                Log.i(TAG, "CardEmulation.unsetPreferredService onPause success: " + success);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to unsetPreferredService in onPause: " + e.getMessage());
        }
        super.onPause();
    }
}
