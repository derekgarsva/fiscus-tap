'use client';

// Export all types and validation utilities
export * from './types';

// Export Capacitor bridge and helper functions
export {
  FiscusNfc,
  FiscusNfcBridge,
  isBrowser,
  isNativeAndroid,
  isIos,
  isNativeIos,
  checkNfcCapabilities,
  subscribeNfcEvent,
  onTagDiscovered,
  onHcePayloadSent,
  onHceDeactivated,
  onReaderError,
  onHceError,
  startChargeSession,
  stopChargeSession,
  startPayerReader,
  stopPayerReader,
} from './FiscusNfcBridge';

// Export Web fallback
export { FiscusNfcWeb } from './FiscusNfcWeb';

// ============================================================================
// React 18 Hooks for Next.js 14 App Router Views
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  NfcStatus,
  HceSessionOptions,
  ReaderModeOptions,
  TagDiscoveredEvent,
} from './types';
import {
  checkNfcCapabilities,
  startChargeSession,
  stopChargeSession,
  startPayerReader,
  stopPayerReader,
  onTagDiscovered,
  onHcePayloadSent,
  onHceDeactivated,
  onReaderError,
} from './FiscusNfcBridge';

/**
 * Hook to inspect hardware NFC capabilities.
 */
export function useNfcStatus() {
  const [status, setStatus] = useState<NfcStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await checkNfcCapabilities();
    setStatus(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}

/**
 * Hook for Terminal POS views (src/app/cobrar/page.tsx).
 * Manages arming HCE charge sessions and receiving payload transfer events.
 */
export function useHceSession() {
  const [isArmed, setIsArmed] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isPayloadSent, setIsPayloadSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armSession = useCallback(async (options: HceSessionOptions) => {
    try {
      setError(null);
      setIsPayloadSent(false);
      const res = await startChargeSession(options);
      setIsArmed(true);
      setActiveSessionId(res.sessionId);
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, []);

  const disarmSession = useCallback(async () => {
    try {
      await stopChargeSession();
      setIsArmed(false);
      setActiveSessionId(null);
    } catch (err: unknown) {
      console.warn('Error stopping HCE session:', err);
    }
  }, []);

  useEffect(() => {
    if (!isArmed) return;

    const unsubPayloadSent = onHcePayloadSent((evt) => {
      if (evt.sessionId === activeSessionId) {
        setIsPayloadSent(true);
      }
    });

    const unsubDeactivated = onHceDeactivated((evt) => {
      if (evt.reasonText === 'LINK_LOSS') {
        console.info('HCE Link Loss detected');
      }
    });

    return () => {
      unsubPayloadSent();
      unsubDeactivated();
    };
  }, [isArmed, activeSessionId]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopChargeSession().catch(() => {});
    };
  }, []);

  return {
    isArmed,
    activeSessionId,
    isPayloadSent,
    error,
    armSession,
    disarmSession,
  };
}

/**
 * Hook for Payer views (src/app/pagar/page.tsx).
 * Manages activating IsoDep Reader Mode and capturing discovered tags.
 */
export function useNfcReader(options?: ReaderModeOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredTag, setDiscoveredTag] = useState<TagDiscoveredEvent | null>(null);
  const [readerError, setReaderError] = useState<{ code: string; message: string } | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const startScanning = useCallback(async () => {
    try {
      setReaderError(null);
      setDiscoveredTag(null);
      await startPayerReader(optionsRef.current);
      setIsScanning(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setReaderError({ code: 'READER_START_FAILED', message: msg });
      throw err;
    }
  }, []);

  const stopScanning = useCallback(async () => {
    try {
      await stopPayerReader();
      setIsScanning(false);
    } catch (err: unknown) {
      console.warn('Error stopping reader mode:', err);
    }
  }, []);

  useEffect(() => {
    if (!isScanning) return;

    const unsubTag = onTagDiscovered((evt) => {
      setDiscoveredTag(evt);
    });

    const unsubErr = onReaderError((evt) => {
      setReaderError({ code: evt.code || evt.errorCode || 'UNKNOWN', message: evt.message || evt.errorMessage || '' });
    });

    return () => {
      unsubTag();
      unsubErr();
    };
  }, [isScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPayerReader().catch(() => {});
    };
  }, []);

  return {
    isScanning,
    discoveredTag,
    readerError,
    startScanning,
    stopScanning,
    clearDiscoveredTag: () => setDiscoveredTag(null),
  };
}
