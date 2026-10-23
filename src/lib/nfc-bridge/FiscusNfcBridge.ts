'use client';

import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type {
  FiscusNfcPlugin,
  FiscusNfcEventMap,
  NfcStatus,
  HceSessionOptions,
  ReaderModeOptions,
  StartHceSessionResult,
  StopHceSessionResult,
  StartReaderModeResult,
  StopReaderModeResult,
  TransactionPayload,
  TagDiscoveredEvent,
  HcePayloadSentEvent,
  HceDeactivatedEvent,
  HceErrorEvent,
  ReaderErrorEvent,
} from './types';
import { validateShortApduPayload } from './types';
import { FiscusNfcWeb } from './FiscusNfcWeb';

let sharedWebInstance: FiscusNfcWeb | null = null;

function getWebInstance(): FiscusNfcWeb {
  if (!sharedWebInstance) {
    sharedWebInstance = new FiscusNfcWeb();
  }
  return sharedWebInstance;
}

const nativePlugin = registerPlugin<FiscusNfcPlugin>('FiscusNfc', {
  web: () => getWebInstance(),
});

/**
 * Proxy ensuring web simulation methods execute immediately and synchronously
 * on desktop/testing runtimes, while delegating to native Android IPC when running natively.
 */
export const FiscusNfc: FiscusNfcPlugin & {
  simulateTapEvent?: (payload?: any) => void;
  simulateTap?: (payload?: any) => void;
  simulateReaderError?: (code: string, message: string) => void;
  simulateDeactivation?: (reason?: number) => void;
  simulateLinkLoss?: () => void;
} = new Proxy(nativePlugin as any, {
  get(target, prop, receiver) {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      return Reflect.get(target, prop, receiver);
    }
    const web = getWebInstance();
    if (prop in web && typeof (web as any)[prop] === 'function') {
      return (...args: any[]) => (web as any)[prop](...args);
    }
    return Reflect.get(target, prop, receiver);
  },
});

export const FiscusNfcBridge = FiscusNfc;

/**
 * Checks if the current environment is running in the browser (client-side).
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Checks if running on native Android with hardware Capacitor support.
 */
export function isNativeAndroid(): boolean {
  return isBrowser() && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Checks if running on iOS (Safari, WebKit, or Native iOS).
 */
export function isIos(): boolean {
  if (!isBrowser()) return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Checks if running on native iOS with hardware Capacitor support.
 */
export function isNativeIos(): boolean {
  return isBrowser() && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Safe, non-throwing check of NFC capabilities.
 */
export async function checkNfcCapabilities(): Promise<NfcStatus> {
  if (!isBrowser()) {
    return {
      supported: false,
      enabled: false,
      hceSupported: false,
      readerSupported: false,
      details: 'Server-Side Rendering (Node.js)',
    };
  }
  try {
    return await FiscusNfc.isSupported();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      supported: false,
      enabled: false,
      hceSupported: false,
      readerSupported: false,
      details: `Plugin error: ${message}`,
    };
  }
}

export type UnsubscribeFn = () => void;

/**
 * Subscribes to an NFC plugin event with a synchronous unsubscribe return.
 * 
 * In React 18 StrictMode, effects mount -> unmount -> mount synchronously.
 * Because `FiscusNfc.addListener` returns a Promise<PluginListenerHandle>, standard
 * unmounting before the promise resolves leads to leaked listeners.
 * 
 * This wrapper maintains an `isCancelled` flag so that if the unsubscribe function
 * is called before the handle resolves, `handle.remove()` is automatically invoked upon resolution.
 */
export function subscribeNfcEvent<K extends keyof FiscusNfcEventMap>(
  eventName: K,
  listener: (event: FiscusNfcEventMap[K]) => void
): UnsubscribeFn {
  if (!isBrowser()) {
    return () => {};
  }

  let handle: PluginListenerHandle | null = null;
  let isCancelled = false;

  FiscusNfc.addListener(eventName as any, (data: any) => {
    if (!isCancelled) {
      listener(data);
    }
  }).then((h) => {
    if (isCancelled) {
      h.remove();
    } else {
      handle = h;
    }
  }).catch((err) => {
    console.warn(`[FiscusNfcBridge] Failed to register listener for ${eventName}:`, err);
  });

  return () => {
    isCancelled = true;
    if (handle) {
      handle.remove();
      handle = null;
    }
  };
}

export function onTagDiscovered(listener: (evt: TagDiscoveredEvent) => void): UnsubscribeFn {
  return subscribeNfcEvent('onTagDiscovered', listener);
}

export function onHcePayloadSent(listener: (evt: HcePayloadSentEvent) => void): UnsubscribeFn {
  return subscribeNfcEvent('onHcePayloadSent', listener);
}

export function onHceDeactivated(listener: (evt: HceDeactivatedEvent) => void): UnsubscribeFn {
  return subscribeNfcEvent('onHceDeactivated', listener);
}

export function onReaderError(listener: (evt: ReaderErrorEvent) => void): UnsubscribeFn {
  return subscribeNfcEvent('onReaderError', listener);
}

export function onHceError(listener: (evt: HceErrorEvent) => void): UnsubscribeFn {
  return subscribeNfcEvent('onHceError', listener);
}

/**
 * Arms the terminal for charging, with client-side 240-byte APDU limit validation.
 */
export async function startChargeSession(options: HceSessionOptions): Promise<StartHceSessionResult> {
  if (!isBrowser()) {
    throw new Error('startChargeSession cannot be called during SSR');
  }

  const sessionId = options.sessionId && options.sessionId.trim().length > 0
    ? options.sessionId
    : 'cs_' + Date.now();

  const payload: TransactionPayload = options.payload || {
    sessionId,
    amount: typeof options.amount === 'number' ? options.amount : 0,
    currency: options.currency || 'VES',
    merchantName: options.merchantName || 'Comercio',
    merchantPhone: options.merchantPhone,
    userId: options.userId,
    bankCode: options.bankCode,
    timestamp: Date.now(),
    type: 'CHARGE',
    ...options,
  };

  const validation = validateShortApduPayload(payload);
  if (!validation.valid) {
    throw new Error(
      `PAYLOAD_TOO_LARGE: Carga útil de cobro excede el límite Short APDU de 240 bytes (${validation.byteLength} bytes). Reduzca el nombre del comercio o campos adicionales.`
    );
  }

  return await FiscusNfc.startHceSession({
    ...options,
    sessionId,
    payload,
  });
}

/**
 * Disarms active charge session on the terminal.
 */
export async function stopChargeSession(): Promise<StopHceSessionResult> {
  if (!isBrowser()) return { success: true };
  return await FiscusNfc.stopHceSession();
}

/**
 * Activates NFC reader mode on the payer device.
 */
export async function startPayerReader(options?: ReaderModeOptions): Promise<StartReaderModeResult> {
  if (!isBrowser()) {
    throw new Error('startPayerReader cannot be called during SSR');
  }
  return await FiscusNfc.startReaderMode(options);
}

/**
 * Deactivates NFC reader mode.
 */
export async function stopPayerReader(): Promise<StopReaderModeResult> {
  if (!isBrowser()) return { success: true };
  return await FiscusNfc.stopReaderMode();
}
