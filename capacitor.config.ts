import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fiscus.tap',
  appName: 'Fiscus Tap',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    FiscusNfc: {
      aid: 'F046495343555301',
      category: 'other',
      readerTimeoutMs: 3500,
      presenceCheckDelayMs: 250,
    },
  },
};

export default config;
