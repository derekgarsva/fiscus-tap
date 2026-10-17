'use client';

import { WebPlugin } from '@capacitor/core';
import type {
  FiscusNfcPlugin,
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
  ReaderErrorEvent,
} from './types';
import { validateShortApduPayload } from './types';

const BROADCAST_CHANNEL_NAME = 'fiscus_tap_nfc_channel';

interface BroadcastMessage {
  type: 'HCE_ARMED' | 'HCE_DISARMED' | 'TAP_REQUESTED' | 'PAYMENT_CONFIRMED';
  sessionId?: string;
  payload?: TransactionPayload;
  timestamp?: number;
}

export class FiscusNfcWeb extends WebPlugin implements FiscusNfcPlugin {
  private activeHceSession: HceSessionOptions | null = null;
  private isReaderActive = false;
  private readerTimeoutMs = 3500;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    super();
    this.initBroadcastChannel();
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch {
        this.broadcastChannel = null;
      }
    }
  }

  private handleBroadcastMessage(msg: BroadcastMessage): void {
    if (!msg) return;

    if (msg.type === 'HCE_ARMED' && this.isReaderActive && msg.payload) {
      const tagData: TagDiscoveredEvent = {
        sessionId: msg.payload.sessionId,
        amount: msg.payload.amount,
        currency: msg.payload.currency,
        merchantName: msg.payload.merchantName,
        merchantPhone: msg.payload.merchantPhone,
        payload: msg.payload,
        rawPayload: JSON.stringify(msg.payload),
      };
      this.notifyListeners('onTagDiscovered', tagData);
      this.notifyListeners('nfcTagDiscovered', tagData);
    }

    if (msg.type === 'TAP_REQUESTED' && this.activeHceSession) {
      const payload = this.activeHceSession.payload || (this.activeHceSession as unknown as TransactionPayload);
      const byteLength = new TextEncoder().encode(JSON.stringify(payload)).length;
      const hceData: HcePayloadSentEvent = {
        sessionId: this.activeHceSession.sessionId || '',
        timestamp: Date.now(),
        bytesTransferred: byteLength,
      };
      this.notifyListeners('onHcePayloadSent', hceData);
      this.notifyListeners('hcePayloadSent', hceData);
    }
  }

  // =========================================================================
  // FiscusNfcPlugin Methods
  // =========================================================================

  async isSupported(): Promise<NfcStatus> {
    return {
      supported: true,
      enabled: true,
      hceSupported: true,
      readerSupported: true,
      details: 'Fiscus Tap Web Simulation (Active)',
    };
  }

  async openNfcSettings(): Promise<void> {
    if (typeof window !== 'undefined') {
      console.info('[FiscusNfcWeb] openNfcSettings: Simulación web — sin ajustes de SO en el navegador');
    }
  }

  async startHceSession(options: HceSessionOptions): Promise<StartHceSessionResult> {
    if (!options) {
      throw new Error('HceSessionOptions is required');
    }

    const sessionId = options.sessionId && options.sessionId.trim().length > 0
      ? options.sessionId
      : 'cs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

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
        `PAYLOAD_TOO_LARGE: Payload exceeds Short APDU maximum limit of 240 bytes (actual: ${validation.byteLength} bytes)`
      );
    }

    this.activeHceSession = { ...options, sessionId, payload };

    const eventData = { sessionId };
    this.notifyListeners('onHceSessionStarted', eventData);
    this.notifyListeners('hceSessionStarted', eventData);

    this.broadcastChannel?.postMessage({
      type: 'HCE_ARMED',
      sessionId,
      payload,
      timestamp: Date.now(),
    });

    return { success: true, sessionId };
  }

  async stopHceSession(): Promise<StopHceSessionResult> {
    const prevSession = this.activeHceSession;
    this.activeHceSession = null;

    if (prevSession?.sessionId) {
      this.broadcastChannel?.postMessage({
        type: 'HCE_DISARMED',
        sessionId: prevSession.sessionId,
      });
    }

    return { success: true };
  }

  async startReaderMode(options?: ReaderModeOptions): Promise<StartReaderModeResult> {
    this.isReaderActive = true;
    this.readerTimeoutMs = options?.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 3500;

    return { success: true, timeoutMs: this.readerTimeoutMs };
  }

  async stopReaderMode(): Promise<StopReaderModeResult> {
    this.isReaderActive = false;
    return { success: true };
  }

  // =========================================================================
  // Developer & Test Simulation Hooks
  // =========================================================================

  simulateTapEvent(customPayload?: Partial<TransactionPayload> | HceSessionOptions | TransactionPayload): void {
    // TC-M2-16 & TC-M2-17: Inactive guards suppress callbacks when modes are off
    if (!this.isReaderActive && !this.activeHceSession) {
      return;
    }

    const base = this.activeHceSession?.payload || this.activeHceSession || {};
    const effectivePayload: TransactionPayload = {
      sessionId: customPayload?.sessionId || (base as any).sessionId || ('cs_' + Date.now()),
      amount: typeof customPayload?.amount === 'number'
        ? customPayload.amount
        : (typeof (base as any).amount === 'number' ? (base as any).amount : 100),
      currency: customPayload?.currency || (base as any).currency || 'VES',
      merchantName: customPayload?.merchantName || (base as any).merchantName || 'Comercio',
      merchantPhone: customPayload?.merchantPhone || (base as any).merchantPhone,
      userId: customPayload?.userId || (base as any).userId,
      bankCode: customPayload?.bankCode || (base as any).bankCode,
      timestamp: Date.now(),
      type: 'CHARGE',
      ...(customPayload || {}),
    };

    if (this.isReaderActive) {
      const tagData: TagDiscoveredEvent = {
        sessionId: effectivePayload.sessionId,
        amount: effectivePayload.amount,
        currency: effectivePayload.currency,
        merchantName: effectivePayload.merchantName,
        merchantPhone: effectivePayload.merchantPhone,
        payload: effectivePayload,
        rawPayload: JSON.stringify(effectivePayload),
      };
      this.notifyListeners('onTagDiscovered', tagData);
      this.notifyListeners('nfcTagDiscovered', tagData);
    }

    if (this.activeHceSession) {
      const byteLength = new TextEncoder().encode(JSON.stringify(effectivePayload)).length;
      const hceData: HcePayloadSentEvent = {
        sessionId: effectivePayload.sessionId,
        timestamp: Date.now(),
        bytesTransferred: byteLength,
      };
      this.notifyListeners('onHcePayloadSent', hceData);
      this.notifyListeners('hcePayloadSent', hceData);
    }

    this.broadcastChannel?.postMessage({
      type: 'TAP_REQUESTED',
      sessionId: effectivePayload.sessionId,
      payload: effectivePayload,
    });
  }

  simulateTap(customPayload?: Partial<TransactionPayload> | HceSessionOptions | TransactionPayload): void {
    this.simulateTapEvent(customPayload);
  }

  simulateReaderError(code: string, message: string): void {
    const errData: ReaderErrorEvent = {
      code,
      message,
      errorCode: code,
      errorMessage: message,
    };
    this.notifyListeners('onReaderError', errData);
    this.notifyListeners('readerError', errData);
  }

  simulateDeactivation(reason: number = 0): void {
    const deactData: HceDeactivatedEvent = {
      reason,
      reasonText: reason === 0 ? 'LINK_LOSS' : (reason === 1 ? 'DESELECTED' : 'UNKNOWN'),
    };
    this.notifyListeners('onHceDeactivated', deactData);
    this.notifyListeners('hceSessionDeactivated', deactData);
  }

  simulateLinkLoss(): void {
    this.simulateDeactivation(0);
    this.simulateReaderError(
      'ENLACE_PERDIDO_MANTEN_TELEFONOS_JUNTOS',
      'Los teléfonos se separaron antes de completar el intercambio.'
    );
  }

  simulateCardTap(cardDetails?: {
    cardBrand?: string;
    maskedPan?: string;
    cardUid?: string;
  }): void {
    const brand = cardDetails?.cardBrand || 'Visa Débito Contactless';
    const pan = cardDetails?.maskedPan || '4*** **** **** 8421';
    const uid = cardDetails?.cardUid || '4BA2189F';
    const cardData: TagDiscoveredEvent = {
      sessionId: 'card_' + Date.now(),
      amount: this.activeHceSession?.amount || 0,
      currency: 'VES',
      merchantName: this.activeHceSession?.merchantName || 'Comercio Fiscus',
      rawPayload: JSON.stringify({
        type: 'CONTACTLESS_CARD',
        isPhysicalCard: true,
        cardBrand: brand,
        cardType: 'Débito / Crédito',
        maskedPan: pan,
        cardUid: uid,
      }),
      payload: {
        sessionId: 'card_' + Date.now(),
        amount: this.activeHceSession?.amount || 0,
        currency: 'VES',
        merchantName: this.activeHceSession?.merchantName || 'Comercio Fiscus',
        isPhysicalCard: true,
        cardBrand: brand,
        cardType: 'Débito / Crédito',
        maskedPan: pan,
        cardUid: uid,
        type: 'CHARGE',
      },
      isPhysicalCard: true,
      cardBrand: brand,
      cardType: 'Débito / Crédito',
      maskedPan: pan,
      cardUid: uid,
      type: 'CONTACTLESS_CARD',
    };
    this.notifyListeners('onTagDiscovered', cardData);
    this.notifyListeners('nfcTagDiscovered', cardData);
  }
}
