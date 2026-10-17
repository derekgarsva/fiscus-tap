/**
 * Simulated ISO/IEC 7816-4 & IsoDep Transceiver Engine for Fiscus Tap
 * 
 * Hardware-free in-memory transceiver that simulates:
 * 1. Android HostApduService (Type 4 Tag / ISO 7816-4 Smart Card)
 * 2. Android IsoDep Reader Mode (IsoDep Transceiver)
 * 3. SUDEBAN C2P Banking Reference Generator
 * 4. In-Memory Atomic Ledger (simulating Supabase execute_tap_transfer RPC)
 */

import { createHash } from 'node:crypto';

// ============================================================================
// Constants & Hex Definitions
// ============================================================================

export const CANONICAL_AID = 'F046495343555301'; // 8-byte Fiscus Tap AID
export const CANONICAL_AID_BUFFER = Buffer.from(CANONICAL_AID, 'hex');

export const APDU_SW = {
  SUCCESS: { sw1: 0x90, sw2: 0x00, hex: '9000' },
  FILE_NOT_FOUND: { sw1: 0x6a, sw2: 0x82, hex: '6A82' }, // AID not recognized
  INCORRECT_P1P2: { sw1: 0x6a, sw2: 0x86, hex: '6A86' },
  WRONG_LENGTH: { sw1: 0x67, sw2: 0x00, hex: '6700' },
  INS_NOT_SUPPORTED: { sw1: 0x6d, sw2: 0x00, hex: '6D00' },
  CLA_NOT_SUPPORTED: { sw1: 0x6e, sw2: 0x00, hex: '6E00' },
  CONDITIONS_NOT_SATISFIED: { sw1: 0x69, sw2: 0x85, hex: '6985' },
  SECURITY_NOT_SATISFIED: { sw1: 0x69, sw2: 0x82, hex: '6982' },
  INTERNAL_ERROR: { sw1: 0x6f, sw2: 0x00, hex: '6F00' },
} as const;

export const APDU_CLA = {
  ISO: 0x00,
  PROPRIETARY: 0x80,
} as const;

export const APDU_INS = {
  SELECT: 0xa4,
  GET_TRANSACTION_DETAILS: 0x10,
  SUBMIT_PAYMENT_TRANSFER: 0x20,
  ACK_CONFIRMATION: 0x30,
} as const;

export const DEACTIVATION_REASON = {
  LINK_LOSS: 0,
  DESELECTED: 1,
} as const;

// ============================================================================
// Data Models & Interfaces
// ============================================================================

export interface ApduResponse {
  raw: Buffer;
  data: Buffer;
  sw1: number;
  sw2: number;
  swHex: string;
  isSuccess: boolean;
}

export interface ChargeRequestPayload {
  type?: 'CHARGE';
  sessionId: string;
  amount: number;
  currency: string;
  merchantName: string;
  merchantPhone?: string;
  userId?: string;
  reference?: string;
  timestamp?: number;
}

export interface SubmitPaymentPayload {
  payerPhone: string;
  payerName: string;
  reference: string;
  authCode?: string;
  timestamp?: number;
}

export interface BankReferenceOptions {
  bankCode: string;
  sessionId: string;
  payerPhone: string;
  amount: number;
}

export interface WalletRecord {
  id: string;
  phone: string;
  userName: string;
  balance: number;
  currency: string;
  defaultBank: string;
}

export interface LedgerTransaction {
  id: string;
  walletId: string;
  sessionId: string;
  type: 'payment_sent' | 'payment_received';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  counterpartyPhone: string;
  counterpartyName: string;
  bankCode: string;
  reference: string;
  timestamp: Date;
}

export interface TransferParams {
  sessionId: string;
  payerPhone: string;
  reference: string;
  bankCode: string;
}

export interface TransferResult {
  success: boolean;
  error?: string;
  alreadyPaid?: boolean;
  sessionId?: string;
  reference?: string;
  amount?: number;
  newPayerBalance?: number;
  newMerchantBalance?: number;
  paidAt?: string;
}

// ============================================================================
// Helper APDU Builders & Encoders
// ============================================================================

export function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.replace(/[\s-]/g, '');
  return Buffer.from(cleanHex, 'hex');
}

export function bufferToHex(buf: Buffer): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

export function buildSelectAidApdu(aidHex = CANONICAL_AID): Buffer {
  const aidBuf = Buffer.from(aidHex, 'hex');
  const lc = aidBuf.length;
  // Format: [CLA 00] [INS A4] [P1 04] [P2 00] [Lc] [AID] [Le 00]
  const apdu = Buffer.alloc(5 + lc + 1);
  apdu[0] = APDU_CLA.ISO;
  apdu[1] = APDU_INS.SELECT;
  apdu[2] = 0x04; // Select by DF name
  apdu[3] = 0x00; // First or only occurrence
  apdu[4] = lc;
  aidBuf.copy(apdu, 5);
  apdu[5 + lc] = 0x00; // Le = 256
  return apdu;
}

export function buildGetDetailsApdu(): Buffer {
  // Format: [CLA 80] [INS 10] [P1 00] [P2 00] [Le 00]
  return Buffer.from([APDU_CLA.PROPRIETARY, APDU_INS.GET_TRANSACTION_DETAILS, 0x00, 0x00, 0x00]);
}

export function buildSubmitPaymentApdu(payload: SubmitPaymentPayload): Buffer {
  const jsonStr = JSON.stringify(payload);
  const dataBuf = Buffer.from(jsonStr, 'utf8');
  if (dataBuf.length > 240) {
    throw new Error(`Payload exceeds maximum Short APDU size of 240 bytes (was ${dataBuf.length})`);
  }
  // Format: [CLA 80] [INS 20] [P1 00] [P2 00] [Lc] [Data] [Le 00]
  const apdu = Buffer.alloc(5 + dataBuf.length + 1);
  apdu[0] = APDU_CLA.PROPRIETARY;
  apdu[1] = APDU_INS.SUBMIT_PAYMENT_TRANSFER;
  apdu[2] = 0x00;
  apdu[3] = 0x00;
  apdu[4] = dataBuf.length;
  dataBuf.copy(apdu, 5);
  apdu[5 + dataBuf.length] = 0x00;
  return apdu;
}

export function buildAckConfirmationApdu(): Buffer {
  // Format: [CLA 80] [INS 30] [P1 00] [P2 00] [Le 00]
  return Buffer.from([APDU_CLA.PROPRIETARY, APDU_INS.ACK_CONFIRMATION, 0x00, 0x00, 0x00]);
}

// ============================================================================
// Venezuelan C2P Banking Reference Generator
// ============================================================================

const BANK_PREFIX_MAP: Record<string, string> = {
  bdv: '0102',
  banesco: '0134',
  mercantil: '0105',
  provincial: '0108',
  'mock-c2p': '0199',
};

export function generateBankingReference(options: BankReferenceOptions): string {
  const bankPrefix = BANK_PREFIX_MAP[options.bankCode.toLowerCase()] || '0134';
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  // Deterministic 6-char hex hash
  const seed = `${options.sessionId}:${options.payerPhone}:${options.amount.toFixed(2)}`;
  const hash = createHash('sha256').update(seed).digest('hex').substring(0, 6).toUpperCase();

  // 2-digit checksum
  const sum = (parseInt(hash, 16) + parseInt(bankPrefix, 10)) % 100;
  const checkStr = String(sum).padStart(2, '0');

  return `FT-${bankPrefix}-${dateStr}-${hash}-${checkStr}`;
}

// ============================================================================
// Simulated HostApduService (HCE Server)
// ============================================================================

export class SimulatedHostApduService {
  private selected = false;
  private sessionNonce = Buffer.alloc(8);
  private payload: Buffer | null = null;
  private protocolVersion = 0x01;
  private role = 0x01; // 0x01: Merchant Terminal, 0x02: Payer Voucher
  private deactivationHistory: number[] = [];
  private failNextWithStatus: Buffer | null = null;
  private linkLost = false;

  constructor() {
    this.sessionNonce.fill(0);
  }

  public setPayload(payload: ChargeRequestPayload): void {
    const jsonStr = JSON.stringify(payload);
    const buf = Buffer.from(jsonStr, 'utf8');
    if (buf.length > 240) {
      throw new Error(`Payload exceeds maximum Short APDU size of 240 bytes (length: ${buf.length})`);
    }
    this.payload = buf;
  }

  public clearPayload(): void {
    this.payload = null;
    this.selected = false;
  }

  public getActivePayload(): Buffer | null {
    return this.payload;
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public getSessionNonce(): Buffer {
    return this.sessionNonce;
  }

  public getProtocolVersion(): number {
    return this.protocolVersion;
  }

  public getRole(): number {
    return this.role;
  }

  public setFailNextWithStatus(sw: { sw1: number; sw2: number }): void {
    this.failNextWithStatus = Buffer.from([sw.sw1, sw.sw2]);
  }

  public simulateLinkLoss(): void {
    this.linkLost = true;
    this.deactivate(DEACTIVATION_REASON.LINK_LOSS);
  }

  public deactivate(reason: number): void {
    this.selected = false;
    this.deactivationHistory.push(reason);
  }

  public getDeactivationHistory(): number[] {
    return [...this.deactivationHistory];
  }

  public processCommandApdu(command: Buffer): Buffer {
    if (this.linkLost) {
      throw new Error('TagLostException: RF link was lost during transceive');
    }

    if (this.failNextWithStatus) {
      const sw = this.failNextWithStatus;
      this.failNextWithStatus = null;
      return sw;
    }

    if (!command || command.length < 4) {
      return Buffer.from([APDU_SW.CONDITIONS_NOT_SATISFIED.sw1, APDU_SW.CONDITIONS_NOT_SATISFIED.sw2]);
    }

    const cla = command[0];
    const ins = command[1];
    const p1 = command[2];
    const p2 = command[3];

    // 1. SELECT AID: 00 A4 04 00 [Lc] [AID] [Le]
    if (cla === APDU_CLA.ISO && ins === APDU_INS.SELECT && p1 === 0x04 && p2 === 0x00) {
      const lc = command.length > 4 ? command[4] : 0;
      if (lc === 8 && command.length >= 5 + 8) {
        const receivedAid = command.subarray(5, 5 + 8);
        if (receivedAid.equals(CANONICAL_AID_BUFFER)) {
          this.selected = true;
          // Generate deterministic non-zero nonce
          for (let i = 0; i < 8; i++) {
            this.sessionNonce[i] = (i * 31 + 17) & 0xff;
          }
          // Response format: [Version 1B] [Role 1B] [Nonce 8B] [SW 90 00]
          return Buffer.concat([
            Buffer.from([this.protocolVersion, this.role]),
            this.sessionNonce,
            Buffer.from([APDU_SW.SUCCESS.sw1, APDU_SW.SUCCESS.sw2]),
          ]);
        }
      }
      return Buffer.from([APDU_SW.FILE_NOT_FOUND.sw1, APDU_SW.FILE_NOT_FOUND.sw2]);
    }

    // Commands past SELECT require active selected state
    if (!this.selected) {
      return Buffer.from([APDU_SW.CONDITIONS_NOT_SATISFIED.sw1, APDU_SW.CONDITIONS_NOT_SATISFIED.sw2]);
    }

    // 2. GET_TRANSACTION_DETAILS: 80 10 00 00 00
    if (cla === APDU_CLA.PROPRIETARY && ins === APDU_INS.GET_TRANSACTION_DETAILS) {
      if (p1 !== 0x00 || p2 !== 0x00) {
        return Buffer.from([APDU_SW.INCORRECT_P1P2.sw1, APDU_SW.INCORRECT_P1P2.sw2]);
      }
      if (!this.payload) {
        return Buffer.from([APDU_SW.CONDITIONS_NOT_SATISFIED.sw1, APDU_SW.CONDITIONS_NOT_SATISFIED.sw2]);
      }
      return Buffer.concat([this.payload, Buffer.from([APDU_SW.SUCCESS.sw1, APDU_SW.SUCCESS.sw2])]);
    }

    // 3. SUBMIT_PAYMENT_TRANSFER: 80 20 00 00 [Lc] [JSON] 00
    if (cla === APDU_CLA.PROPRIETARY && ins === APDU_INS.SUBMIT_PAYMENT_TRANSFER) {
      if (p1 !== 0x00 || p2 !== 0x00) {
        return Buffer.from([APDU_SW.INCORRECT_P1P2.sw1, APDU_SW.INCORRECT_P1P2.sw2]);
      }
      const lc = command.length > 4 ? command[4] : 0;
      if (lc === 0 || command.length < 5 + lc) {
        return Buffer.from([APDU_SW.WRONG_LENGTH.sw1, APDU_SW.WRONG_LENGTH.sw2]);
      }
      const jsonBytes = command.subarray(5, 5 + lc);
      try {
        const parsed = JSON.parse(jsonBytes.toString('utf8'));
        if (!parsed.payerPhone || !parsed.reference) {
          return Buffer.from([APDU_SW.SECURITY_NOT_SATISFIED.sw1, APDU_SW.SECURITY_NOT_SATISFIED.sw2]);
        }
        const confirmResp = Buffer.from(JSON.stringify({ status: 'CONFIRMED', authCode: 'AUTH-OK-9842' }), 'utf8');
        return Buffer.concat([confirmResp, Buffer.from([APDU_SW.SUCCESS.sw1, APDU_SW.SUCCESS.sw2])]);
      } catch {
        return Buffer.from([APDU_SW.CONDITIONS_NOT_SATISFIED.sw1, APDU_SW.CONDITIONS_NOT_SATISFIED.sw2]);
      }
    }

    // 4. ACK_CONFIRMATION: 80 30 00 00 00
    if (cla === APDU_CLA.PROPRIETARY && ins === APDU_INS.ACK_CONFIRMATION) {
      return Buffer.from([APDU_SW.SUCCESS.sw1, APDU_SW.SUCCESS.sw2]);
    }

    // Validate unsupported CLA or INS
    if (cla !== APDU_CLA.PROPRIETARY && cla !== APDU_CLA.ISO) {
      return Buffer.from([APDU_SW.CLA_NOT_SUPPORTED.sw1, APDU_SW.CLA_NOT_SUPPORTED.sw2]);
    }
    return Buffer.from([APDU_SW.INS_NOT_SUPPORTED.sw1, APDU_SW.INS_NOT_SUPPORTED.sw2]);
  }
}

// ============================================================================
// Simulated IsoDep Transceiver (Reader Client)
// ============================================================================

export class SimulatedIsoDepTransceiver {
  private service: SimulatedHostApduService;
  private connected = false;
  private timeoutMs = 3500;
  private artificialDelayMs = 0;

  constructor(service: SimulatedHostApduService) {
    this.service = service;
  }

  public connect(): void {
    this.connected = true;
  }

  public close(): void {
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public setTimeout(ms: number): void {
    this.timeoutMs = ms;
  }

  public getTimeout(): number {
    return this.timeoutMs;
  }

  public setArtificialDelay(ms: number): void {
    this.artificialDelayMs = ms;
  }

  public transceive(command: Buffer): ApduResponse {
    if (!this.connected) {
      throw new Error('IsoDep not connected: Must call connect() before transceive');
    }

    if (this.artificialDelayMs > this.timeoutMs) {
      throw new Error(`TimeoutException: Transceive timed out after ${this.timeoutMs}ms`);
    }

    const raw = this.service.processCommandApdu(command);
    if (!raw || raw.length < 2) {
      throw new Error('Invalid APDU Response: Length must be at least 2 bytes');
    }

    const sw1 = raw[raw.length - 2];
    const sw2 = raw[raw.length - 1];
    const data = raw.subarray(0, raw.length - 2);
    const swHex = `${sw1.toString(16).padStart(2, '0')}${sw2.toString(16).padStart(2, '0')}`.toUpperCase();
    const isSuccess = sw1 === 0x90 && sw2 === 0x00;

    return {
      raw,
      data,
      sw1,
      sw2,
      swHex,
      isSuccess,
    };
  }
}

// ============================================================================
// In-Memory Simulated Supabase Ledger
// ============================================================================

export class SimulatedLedger {
  private wallets: Map<string, WalletRecord> = new Map();
  private chargeSessions: Map<string, {
    id: string;
    amount: number;
    merchantPhone: string;
    merchantName: string;
    status: 'pending' | 'paid';
    reference?: string;
    bankCode?: string;
    paidAt?: string;
  }> = new Map();
  private transactions: LedgerTransaction[] = [];

  constructor() {
    this.seedDefaultWallets();
  }

  private seedDefaultWallets(): void {
    this.wallets.set('04121234567', {
      id: 'usr_merch_01',
      phone: '04121234567',
      userName: 'Comercio Central',
      balance: 1000.0,
      currency: 'VES',
      defaultBank: 'banesco',
    });

    this.wallets.set('04149876543', {
      id: 'usr_payer_01',
      phone: '04149876543',
      userName: 'Cliente Prueba',
      balance: 500.0,
      currency: 'VES',
      defaultBank: 'bdv',
    });
  }

  public registerWallet(wallet: WalletRecord): void {
    this.wallets.set(wallet.phone, { ...wallet });
  }

  public getWallet(phone: string): WalletRecord | undefined {
    return this.wallets.get(phone);
  }

  public createChargeSession(session: {
    id: string;
    amount: number;
    merchantPhone: string;
    merchantName: string;
  }): void {
    this.chargeSessions.set(session.id, {
      ...session,
      status: 'pending',
    });
  }

  public getChargeSession(id: string) {
    return this.chargeSessions.get(id);
  }

  public getTransactions(): LedgerTransaction[] {
    return [...this.transactions];
  }

  /**
   * Simulates the PostgreSQL atomic stored procedure `execute_tap_transfer`
   */
  public executeTapTransfer(params: TransferParams): TransferResult {
    const session = this.chargeSessions.get(params.sessionId);
    if (!session) {
      return { success: false, error: 'SESSION_NOT_FOUND' };
    }

    if (session.status === 'paid') {
      return {
        success: true,
        alreadyPaid: true,
        reference: session.reference,
        amount: session.amount,
      };
    }

    const payer = this.wallets.get(params.payerPhone);
    if (!payer) {
      return { success: false, error: 'PAYER_WALLET_NOT_FOUND' };
    }

    if (payer.balance < session.amount) {
      return {
        success: false,
        error: 'INSUFFICIENT_FUNDS',
      };
    }

    const merchant = this.wallets.get(session.merchantPhone);
    const amount = session.amount;

    // Atomic Balance Mutation
    const payerBefore = payer.balance;
    const payerAfter = payerBefore - amount;
    payer.balance = payerAfter;

    let merchBefore = 0;
    let merchAfter = 0;
    if (merchant) {
      merchBefore = merchant.balance;
      merchAfter = merchBefore + amount;
      merchant.balance = merchAfter;
    }

    const nowIso = new Date().toISOString();
    session.status = 'paid';
    session.reference = params.reference;
    session.bankCode = params.bankCode;
    session.paidAt = nowIso;

    // Record Ledger Entries
    this.transactions.push({
      id: `tx_sent_${Date.now()}`,
      walletId: payer.id,
      sessionId: session.id,
      type: 'payment_sent',
      amount,
      balanceBefore: payerBefore,
      balanceAfter: payerAfter,
      counterpartyPhone: session.merchantPhone,
      counterpartyName: session.merchantName,
      bankCode: params.bankCode,
      reference: params.reference,
      timestamp: new Date(),
    });

    if (merchant) {
      this.transactions.push({
        id: `tx_rec_${Date.now()}`,
        walletId: merchant.id,
        sessionId: session.id,
        type: 'payment_received',
        amount,
        balanceBefore: merchBefore,
        balanceAfter: merchAfter,
        counterpartyPhone: payer.phone,
        counterpartyName: payer.userName,
        bankCode: params.bankCode,
        reference: params.reference,
        timestamp: new Date(),
      });
    }

    return {
      success: true,
      sessionId: session.id,
      reference: params.reference,
      amount,
      newPayerBalance: payerAfter,
      newMerchantBalance: merchant ? merchAfter : undefined,
      paidAt: nowIso,
    };
  }
}
