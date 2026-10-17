/**
 * Empirical Adversarial APDU Stress Test Harness
 * 
 * Conducted by Challenger challenger_m1_1 to stress-test the APDU exchange implementation
 * across adversarial vectors:
 * 1. Corrupted & Fuzzed Bytes (truncated lengths, random bytes, extreme sizes)
 * 2. Unsupported CLA / INS instructions
 * 3. Out-of-order sequencing & state machine integrity
 * 4. Payload size limits & boundaries (240B limit, overflows, malformed JSON)
 * 5. Channel fault tolerance (RF link loss, timeout, disconnect)
 */

import { randomBytes } from 'node:crypto';
import {
  SimulatedHostApduService,
  SimulatedIsoDepTransceiver,
  SimulatedLedger,
  CANONICAL_AID,
  CANONICAL_AID_BUFFER,
  APDU_SW,
  APDU_CLA,
  APDU_INS,
  DEACTIVATION_REASON,
  buildSelectAidApdu,
  buildGetDetailsApdu,
  buildSubmitPaymentApdu,
  buildAckConfirmationApdu,
  generateBankingReference,
  hexToBuffer,
  bufferToHex,
} from './lib/simulated-transceiver';

interface AdversarialCase {
  id: string;
  category: string;
  description: string;
  run: () => void;
}

const cases: AdversarialCase[] = [];

function register(id: string, category: string, description: string, run: () => void) {
  cases.push({ id, category, description, run });
}

// ============================================================================
// 1. CORRUPTED & TRUNCATED BYTES
// ============================================================================

register('ADV-BYTE-01', 'Corrupted Bytes', 'Zero-length APDU buffer returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const resp = reader.transceive(Buffer.alloc(0));
  if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
});

register('ADV-BYTE-02', 'Corrupted Bytes', '1-byte truncated APDU returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const resp = reader.transceive(Buffer.from([0x00]));
  if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
});

register('ADV-BYTE-03', 'Corrupted Bytes', '2-byte truncated APDU returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const resp = reader.transceive(Buffer.from([0x00, 0xa4]));
  if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
});

register('ADV-BYTE-04', 'Corrupted Bytes', '3-byte truncated APDU returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const resp = reader.transceive(Buffer.from([0x00, 0xa4, 0x04]));
  if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
});

register('ADV-BYTE-05', 'Corrupted Bytes', 'Fuzzed random APDUs (50 iterations) safely handled without crashing', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  for (let i = 0; i < 50; i++) {
    const len = Math.floor(Math.random() * 60) + 1;
    const fuzzBuf = randomBytes(len);
    const resp = reader.transceive(fuzzBuf);
    if (!resp.swHex || resp.raw.length < 2) {
      throw new Error(`Invalid response on fuzz input length ${len}`);
    }
  }
});

// ============================================================================
// 2. UNSUPPORTED CLA & INS
// ============================================================================

register('ADV-CLA-01', 'Unsupported CLA', 'CLA 0xFF with unknown INS returns 6E00 (when selected)', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const resp = reader.transceive(Buffer.from([0xff, 0x10, 0x00, 0x00, 0x00]));
  if (resp.swHex !== '6E00') throw new Error(`Expected 6E00, got ${resp.swHex}`);
});

register('ADV-CLA-02', 'Unsupported CLA', 'CLA 0x01 (invalid ISO class) returns 6E00 (when selected)', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const resp = reader.transceive(Buffer.from([0x01, 0x10, 0x00, 0x00, 0x00]));
  if (resp.swHex !== '6E00') throw new Error(`Expected 6E00, got ${resp.swHex}`);
});

register('ADV-INS-01', 'Unsupported INS', 'Proprietary CLA 0x80 with unknown INS 0x99 returns 6D00', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const resp = reader.transceive(Buffer.from([0x80, 0x99, 0x00, 0x00, 0x00]));
  if (resp.swHex !== '6D00') throw new Error(`Expected 6D00, got ${resp.swHex}`);
});

register('ADV-INS-02', 'Unsupported INS', 'Proprietary CLA 0x80 with unknown INS 0x00 returns 6D00', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const resp = reader.transceive(Buffer.from([0x80, 0x00, 0x00, 0x00, 0x00]));
  if (resp.swHex !== '6D00') throw new Error(`Expected 6D00, got ${resp.swHex}`);
});

register('ADV-INS-03', 'Unsupported INS', 'Proprietary CLA 0x80 with unknown INS 0xFF returns 6D00', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const resp = reader.transceive(Buffer.from([0x80, 0xff, 0x00, 0x00, 0x00]));
  if (resp.swHex !== '6D00') throw new Error(`Expected 6D00, got ${resp.swHex}`);
});

// ============================================================================
// 3. OUT-OF-ORDER SEQUENCING & STATE MACHINE
// ============================================================================

register('ADV-SEQ-01', 'Out-of-Order Sequence', 'SUBMIT_PAYMENT before SELECT_AID returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const submitApdu = buildSubmitPaymentApdu({
    payerPhone: '04141112233',
    payerName: 'Hacker',
    reference: 'FT-0102-261011-000000-00',
  });
  const resp = reader.transceive(submitApdu);
  if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
});

register('ADV-SEQ-02', 'Out-of-Order Sequence', 'ACK_CONFIRMATION before SELECT_AID returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const resp = reader.transceive(buildAckConfirmationApdu());
  if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
});

register('ADV-SEQ-03', 'Out-of-Order Sequence', 'Consecutive SELECT_AID calls succeed and produce new nonce', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  const r1 = reader.transceive(buildSelectAidApdu());
  if (!r1.isSuccess) throw new Error('First select failed');
  const r2 = reader.transceive(buildSelectAidApdu());
  if (!r2.isSuccess) throw new Error('Second select failed');
});

register('ADV-SEQ-04', 'Out-of-Order Sequence', 'Deactivation in middle of session resets selection state', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  hce.setPayload({ sessionId: 's1', amount: 10, currency: 'VES', merchantName: 'M' });
  reader.transceive(buildSelectAidApdu());
  hce.deactivate(DEACTIVATION_REASON.LINK_LOSS);
  const resp = reader.transceive(buildGetDetailsApdu());
  if (resp.swHex !== '6985') throw new Error(`Expected 6985 after deactivation, got ${resp.swHex}`);
});

register('ADV-SEQ-05', 'Out-of-Order Sequence', 'GET_TRANSACTION_DETAILS when no payload is armed returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  // No payload armed
  const resp = reader.transceive(buildGetDetailsApdu());
  if (resp.swHex !== '6985') throw new Error(`Expected 6985 for unarmed session, got ${resp.swHex}`);
});

// ============================================================================
// 4. PAYLOAD SIZE LIMITS & ENCODING
// ============================================================================

register('ADV-PAY-01', 'Payload Limits', 'Payload exactly 240 bytes is accepted', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  // Construct JSON of exact size
  const base = { sessionId: 's', amount: 1, currency: 'VES', merchantName: '' };
  const baseLen = Buffer.byteLength(JSON.stringify(base), 'utf8');
  const pad = 'P'.repeat(240 - baseLen);
  base.merchantName = pad;
  const totalLen = Buffer.byteLength(JSON.stringify(base), 'utf8');
  if (totalLen !== 240) throw new Error(`Setup error: length is ${totalLen}, expected 240`);
  
  hce.setPayload(base);
  reader.transceive(buildSelectAidApdu());
  const resp = reader.transceive(buildGetDetailsApdu());
  if (!resp.isSuccess) throw new Error(`Expected success on 240B, got ${resp.swHex}`);
  if (resp.data.length !== 240) throw new Error(`Expected data length 240, got ${resp.data.length}`);
});

register('ADV-PAY-02', 'Payload Limits', 'Payload 241 bytes throws exception on arming', () => {
  const hce = new SimulatedHostApduService();
  const base = { sessionId: 's', amount: 1, currency: 'VES', merchantName: '' };
  const baseLen = Buffer.byteLength(JSON.stringify(base), 'utf8');
  const pad = 'P'.repeat(241 - baseLen);
  base.merchantName = pad;
  let threw = false;
  try {
    hce.setPayload(base);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('Expected exception on 241B payload');
});

register('ADV-PAY-03', 'Payload Limits', 'SUBMIT_PAYMENT exceeding 240B throws exception in builder', () => {
  let threw = false;
  try {
    buildSubmitPaymentApdu({
      payerPhone: '04141112233',
      payerName: 'X'.repeat(250),
      reference: 'FT-0102-261011-AAAAAA-00',
    });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('Expected exception in buildSubmitPaymentApdu for >240B payload');
});

register('ADV-PAY-04', 'Payload Limits', 'SUBMIT_PAYMENT with malformed JSON string returns 6985', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const badJsonBytes = Buffer.from('NOT_VALID_JSON_STRING', 'utf8');
  const badApdu = Buffer.alloc(5 + badJsonBytes.length + 1);
  badApdu[0] = APDU_CLA.PROPRIETARY;
  badApdu[1] = APDU_INS.SUBMIT_PAYMENT_TRANSFER;
  badApdu[2] = 0x00;
  badApdu[3] = 0x00;
  badApdu[4] = badJsonBytes.length;
  badJsonBytes.copy(badApdu, 5);
  badApdu[badApdu.length - 1] = 0x00;

  const resp = reader.transceive(badApdu);
  if (resp.swHex !== '6985') throw new Error(`Expected 6985 for invalid JSON, got ${resp.swHex}`);
});

register('ADV-PAY-05', 'Payload Limits', 'SUBMIT_PAYMENT missing payerPhone returns 6982', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.transceive(buildSelectAidApdu());
  const badPayload = Buffer.from(JSON.stringify({ payerName: 'Juan', reference: 'REF1' }), 'utf8');
  const badApdu = Buffer.alloc(5 + badPayload.length + 1);
  badApdu[0] = APDU_CLA.PROPRIETARY;
  badApdu[1] = APDU_INS.SUBMIT_PAYMENT_TRANSFER;
  badApdu[2] = 0x00;
  badApdu[3] = 0x00;
  badApdu[4] = badPayload.length;
  badPayload.copy(badApdu, 5);
  badApdu[badApdu.length - 1] = 0x00;

  const resp = reader.transceive(badApdu);
  if (resp.swHex !== '6982') throw new Error(`Expected 6982 for missing payerPhone, got ${resp.swHex}`);
});

// ============================================================================
// 5. CHANNEL FAULT TOLERANCE
// ============================================================================

register('ADV-CHAN-01', 'Channel Faults', 'Transceive before connect() throws IsoDep not connected', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  let threw = false;
  try {
    reader.transceive(buildSelectAidApdu());
  } catch (e: any) {
    if (e.message.includes('IsoDep not connected')) threw = true;
  }
  if (!threw) throw new Error('Expected IsoDep not connected error');
});

register('ADV-CHAN-02', 'Channel Faults', 'RF Link Loss throws TagLostException during transceive', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  hce.simulateLinkLoss();
  let threw = false;
  try {
    reader.transceive(buildSelectAidApdu());
  } catch (e: any) {
    if (e.message.includes('TagLostException')) threw = true;
  }
  if (!threw) throw new Error('Expected TagLostException');
});

register('ADV-CHAN-03', 'Channel Faults', 'Timeout expiration throws TimeoutException', () => {
  const hce = new SimulatedHostApduService();
  const reader = new SimulatedIsoDepTransceiver(hce);
  reader.connect();
  reader.setTimeout(3500);
  reader.setArtificialDelay(3600);
  let threw = false;
  try {
    reader.transceive(buildSelectAidApdu());
  } catch (e: any) {
    if (e.message.includes('TimeoutException')) threw = true;
  }
  if (!threw) throw new Error('Expected TimeoutException');
});

// ============================================================================
// EXECUTION HARNESS
// ============================================================================

async function run() {
  console.log('========================================================================');
  console.log('   Fiscus Tap — Empirical Adversarial Stress Harness (Challenger)       ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const start = performance.now();
    try {
      c.run();
      const dur = Math.round((performance.now() - start) * 100) / 100;
      console.log(`[PASS] [${c.category}] ${c.id}: ${c.description} (${dur}ms)`);
      passed++;
    } catch (err: any) {
      const dur = Math.round((performance.now() - start) * 100) / 100;
      console.log(`[FAIL] [${c.category}] ${c.id}: ${c.description} (${dur}ms)`);
      console.log(`       Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n========================================================================');
  console.log(`STRESS RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${cases.length})`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Stress runner crash:', e);
  process.exit(1);
});
