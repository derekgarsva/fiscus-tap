'use client';

import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Hardware and platform NFC status report.
 */
export interface NfcStatus {
  /**
   * Whether NFC hardware is physically present on the device.
   * On web browsers, true if Web Simulation is active, false otherwise.
   */
  supported: boolean;

  /**
   * Whether the NFC controller is currently enabled in OS settings.
   */
  enabled: boolean;

  /**
   * Whether Android Host Card Emulation (HCE) ISO 7816-4 is supported.
   */
  hceSupported: boolean;

  /**
   * Whether low-level ISO 14443-4 (IsoDep) reader mode is supported.
   */
  readerSupported?: boolean;

  /**
   * Human-readable diagnostic description or active simulation mode.
   */
  details?: string;
}

/**
 * ISO 7816-4 APDU Short Payload structure.
 * Must stay strictly <= 240 bytes when JSON-serialized to prevent RF packet truncation.
 */
export interface TransactionPayload {
  /** Unique session identifier (e.g. 'ch_9a3f1b' or UUID) */
  sessionId: string;

  /** Payment amount in currency units (e.g. 150.50) */
  amount: number;

  /** Currency code ('VES' or 'USD') */
  currency: string;

  /** Merchant business name displayed to the payer */
  merchantName: string;

  /** Merchant contact phone number (optional) */
  merchantPhone?: string;

  /** Merchant user account ID in Supabase (optional) */
  userId?: string;

  /** Pre-allocated banking reference or session token (optional) */
  reference?: string;

  /** Designated bank routing code (e.g. '0134', '0102') (optional) */
  bankCode?: string;

  /** Unix epoch timestamp in milliseconds (optional) */
  timestamp?: number;

  /** Protocol message type discriminator */
  type?: 'CHARGE';

  [key: string]: unknown;
}

/**
 * Options for arming an HCE charge session on the terminal phone.
 */
export interface HceSessionOptions {
  /** Role in the transaction (defaults to 'charge') */
  role?: 'charge' | 'payer';

  /** Session identifier (synthesized if omitted) */
  sessionId?: string;

  /** Transaction amount */
  amount?: number;

  /** Currency code */
  currency?: string;

  /** Merchant name */
  merchantName?: string;

  /** Merchant phone number (optional) */
  merchantPhone?: string;

  /** Merchant user ID (optional) */
  userId?: string;

  /** Bank code (optional) */
  bankCode?: string;

  /** Explicit payload override (if provided, overrides constructed payload) */
  payload?: TransactionPayload;

  [key: string]: unknown;
}

/**
 * Options for configuring Android IsoDep Reader Mode.
 */
export interface ReaderModeOptions {
  /**
   * RF transceive timeout in milliseconds.
   * Default: 3500ms (tolerates natural hand shake / movement during tap).
   */
  timeoutMs?: number;

  /**
   * Delay in milliseconds between presence checks.
   * Default: 250ms.
   */
  presenceCheckDelayMs?: number;

  [key: string]: unknown;
}

export interface StartHceSessionResult {
  success: boolean;
  sessionId: string;
  priorityGranted?: boolean;
  bytesTransferred?: number;
}

export interface StopHceSessionResult {
  success: boolean;
}

export interface StartReaderModeResult {
  success: boolean;
  timeoutMs?: number;
}

export interface StopReaderModeResult {
  success: boolean;
}

/**
 * Fired when an HCE charge session is successfully armed in memory.
 */
export interface HceSessionStartedEvent {
  sessionId: string;
}

/**
 * Fired when an external reader sends SELECT AID matching Fiscus Tap (F046495343555301).
 */
export interface HceAidSelectedEvent {
  aid: string;
  sessionNonce: string; // Hex representation of 8-byte nonce
}

/**
 * Fired when FiscusHceService successfully returns the charge payload over RF.
 */
export interface HcePayloadSentEvent {
  sessionId: string;
  timestamp: number;
  bytesTransferred: number;
}

/**
 * Fired when FiscusHceService receives payment confirmation (SUBMIT_PAYMENT_TRANSFER).
 */
export interface HcePaymentReceivedEvent {
  payerPayloadJson?: string;
  payerPayload?: Record<string, unknown> | string;
  rawPayload?: string;
}

/**
 * Deactivation reasons matching Android HostApduService.
 */
export const HCE_DEACTIVATION_REASON = {
  LINK_LOSS: 0,
  DESELECTED: 1,
} as const;

export type HceDeactivationReason = typeof HCE_DEACTIVATION_REASON[keyof typeof HCE_DEACTIVATION_REASON];

/**
 * Fired when the HCE service is deactivated by the NFC controller.
 */
export interface HceDeactivatedEvent {
  reason: number;
  reasonText: 'LINK_LOSS' | 'DESELECTED' | 'UNKNOWN' | string;
}

/**
 * Fired when an internal error occurs within the HCE service.
 */
export interface HceErrorEvent {
  code: string;
  message: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Fired by FiscusReaderCallback when an HCE target tag is discovered and details read.
 */
export interface TagDiscoveredEvent {
  sessionId?: string;
  amount?: number;
  currency?: string;
  merchantName?: string;
  merchantPhone?: string;
  payload?: TransactionPayload | Record<string, unknown>;
  rawPayload: string;
  isPhysicalCard?: boolean;
  cardBrand?: string;
  cardType?: string;
  maskedPan?: string;
  cardUid?: string;
  cardHolder?: string;
  type?: string;
}

export type NfcTagDiscoveredEvent = TagDiscoveredEvent;

/**
 * Fired by FiscusReaderCallback when tag reading fails or link is lost.
 */
export interface ReaderErrorEvent {
  code: string;
  message: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface FiscusNfcEventMap {
  onHceSessionStarted: HceSessionStartedEvent;
  hceSessionStarted: HceSessionStartedEvent;
  onHceAidSelected: HceAidSelectedEvent;
  onHcePayloadSent: HcePayloadSentEvent;
  hcePayloadSent: HcePayloadSentEvent;
  onHcePaymentReceived: HcePaymentReceivedEvent;
  onHceDeactivated: HceDeactivatedEvent;
  hceSessionDeactivated: HceDeactivatedEvent;
  onHceError: HceErrorEvent;
  onTagDiscovered: TagDiscoveredEvent;
  nfcTagDiscovered: TagDiscoveredEvent;
  onReaderError: ReaderErrorEvent;
  readerError: ReaderErrorEvent;
}

/**
 * Main Capacitor Plugin interface for Fiscus Tap NFC Bridge.
 */
export interface FiscusNfcPlugin {
  /**
   * Checks whether the device supports NFC, whether it is enabled,
   * and whether HCE / Reader modes are available.
   */
  isSupported(): Promise<NfcStatus>;

  /**
   * Opens Android NFC settings page so the user can enable NFC.
   */
  openNfcSettings(): Promise<void>;

  /**
   * Arms the HCE service with an active charge payload.
   */
  startHceSession(options: HceSessionOptions): Promise<StartHceSessionResult>;

  /**
   * Clears the active HCE session and disarms card emulation.
   */
  stopHceSession(): Promise<StopHceSessionResult>;

  /**
   * Activates ISO 14443-4 Reader Mode on the foreground Activity.
   */
  startReaderMode(options?: ReaderModeOptions): Promise<StartReaderModeResult>;

  /**
   * Deactivates Reader Mode.
   */
  stopReaderMode(): Promise<StopReaderModeResult>;

  /**
   * Registers a strongly-typed event listener.
   */
  addListener<K extends keyof FiscusNfcEventMap>(
    eventName: K,
    listener: (event: FiscusNfcEventMap[K]) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Overload for untyped or alias event strings.
   */
  addListener(
    eventName: string,
    listener: (event: any) => void
  ): Promise<PluginListenerHandle>;

  /**
   * Removes all registered event listeners.
   */
  removeAllListeners(): Promise<void>;
}

export const MAX_SHORT_APDU_PAYLOAD_BYTES = 240;

/**
 * Validates that a transaction payload complies with the 240-byte Short APDU threshold.
 */
export function validateShortApduPayload(payload: unknown): {
  valid: boolean;
  byteLength: number;
  maxBytes: number;
  serialized: string;
} {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const byteLength = new TextEncoder().encode(serialized).length;
  return {
    valid: byteLength <= MAX_SHORT_APDU_PAYLOAD_BYTES,
    byteLength,
    maxBytes: MAX_SHORT_APDU_PAYLOAD_BYTES,
    serialized,
  };
}

/**
 * Safely parses raw JSON payload received over NFC into a TransactionPayload.
 */
export function parseTransactionPayload(raw: string): TransactionPayload | null {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!data.sessionId || typeof data.amount !== 'number') return null;
    return {
      sessionId: String(data.sessionId),
      amount: Number(data.amount),
      currency: String(data.currency || 'VES'),
      merchantName: String(data.merchantName || 'Comercio'),
      merchantPhone: data.merchantPhone ? String(data.merchantPhone) : undefined,
      userId: data.userId ? String(data.userId) : undefined,
      reference: data.reference ? String(data.reference) : undefined,
      bankCode: data.bankCode ? String(data.bankCode) : undefined,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : undefined,
      type: 'CHARGE',
      ...data,
    };
  } catch {
    return null;
  }
}
