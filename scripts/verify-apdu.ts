#!/usr/bin/env tsx
/**
 * Standalone ISO 7816-4 APDU Protocol & Multi-Tier Verification Runner for Fiscus Tap
 * 
 * Verifies Tiers 1-4:
 * - Tier 1: Feature Coverage (Nominal Exchanges across 9 features)
 * - Tier 2: Boundary & Corner Cases (Max payload 240B, foreign AID, Link loss, Timeout, Unsupported CLA/INS)
 * - Tier 3: Cross-Feature Combinations (Pairwise pipelines: Session -> HCE -> Reader -> Reference -> Ledger)
 * - Tier 4: Real-World Scenarios (POS checkout, 1-touch tap, balance settlement, duplicate protection)
 */

import {
  SimulatedHostApduService,
  SimulatedIsoDepTransceiver,
  SimulatedLedger,
  CANONICAL_AID,
  buildSelectAidApdu,
  buildGetDetailsApdu,
  buildSubmitPaymentApdu,
  buildAckConfirmationApdu,
  generateBankingReference,
  bufferToHex,
  hexToBuffer,
  APDU_SW,
} from './lib/simulated-transceiver';

interface TestResult {
  name: string;
  tier: number;
  feature: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function runCheck(
  tier: number,
  feature: string,
  name: string,
  fn: () => void | Promise<void>
) {
  const start = performance.now();
  try {
    fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ name, tier, feature, passed: true, durationMs });
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ name, tier, feature, passed: false, error: err.message, durationMs });
  }
}

async function main() {
  console.log('========================================================================');
  console.log('    Fiscus Tap — ISO 7816-4 Hardware-Free Verification Harness          ');
  console.log('========================================================================\n');

  // ==========================================================================
  // TIER 1: Feature Coverage (Nominal Cases)
  // ==========================================================================
  
  // FEAT-01: HostApduService
  runCheck(1, 'FEAT-01', 'HCE Service initializes and produces valid 8-byte session nonce on SELECT', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    const resp = reader.transceive(buildSelectAidApdu());
    if (!resp.isSuccess) throw new Error(`Expected success 9000, got ${resp.swHex}`);
    if (resp.data.length !== 10) throw new Error(`Expected 10 bytes (ver+role+nonce), got ${resp.data.length}`);
    if (resp.data[0] !== 0x01) throw new Error(`Expected version 0x01, got ${resp.data[0]}`);
  });

  // FEAT-02: OS Conflict Elimination
  runCheck(1, 'FEAT-02', 'Proprietary Category F AID F046495343555301 responds with 9000', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    const resp = reader.transceive(buildSelectAidApdu(CANONICAL_AID));
    if (resp.swHex !== '9000') throw new Error(`Expected 9000, got ${resp.swHex}`);
  });

  // FEAT-03: Reader Mode (IsoDep)
  runCheck(1, 'FEAT-03', 'IsoDep reader connects with 3500ms timeout configuration', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    reader.setTimeout(3500);
    if (reader.getTimeout() !== 3500) throw new Error('Timeout configuration mismatch');
    if (!reader.isConnected()) throw new Error('Reader should be connected');
  });

  // FEAT-04: ISO 7816-4 APDU Protocol
  runCheck(1, 'FEAT-04', 'Nominal SELECT_AID + GET_TRANSACTION_DETAILS returns charge JSON', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    hce.setPayload({
      type: 'CHARGE',
      sessionId: 'ch_cli_101',
      amount: 150.0,
      currency: 'VES',
      merchantName: 'Cafeteria Plaza',
    });
    const sResp = reader.transceive(buildSelectAidApdu());
    if (!sResp.isSuccess) throw new Error('Select failed');
    const dResp = reader.transceive(buildGetDetailsApdu());
    if (!dResp.isSuccess) throw new Error('Get details failed');
    const data = JSON.parse(dResp.data.toString('utf8'));
    if (data.sessionId !== 'ch_cli_101' || data.amount !== 150.0) {
      throw new Error('Payload mismatch');
    }
  });

  // FEAT-05: Capacitor Plugin Bridge Mock
  runCheck(1, 'FEAT-05', 'HCE session armed through event payload simulates native bridge', () => {
    const hce = new SimulatedHostApduService();
    hce.setPayload({
      sessionId: 'sess_bridge_01',
      amount: 45.0,
      currency: 'USD',
      merchantName: 'Supermarket',
    });
    if (!hce.getActivePayload()) throw new Error('Payload not active');
  });

  // FEAT-06: Tap UI Data Exchange (No QR Code)
  runCheck(1, 'FEAT-06', 'Two-way APDU roundtrip completes without QR fallback', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    hce.setPayload({
      sessionId: 'ch_noqr_99',
      amount: 88.5,
      currency: 'VES',
      merchantName: 'Bodega El Sol',
    });
    reader.transceive(buildSelectAidApdu());
    const details = reader.transceive(buildGetDetailsApdu());
    const submit = reader.transceive(
      buildSubmitPaymentApdu({
        payerPhone: '04141112233',
        payerName: 'Pedro Perez',
        reference: 'FT-0102-261011-AAAAAA-12',
      })
    );
    if (!details.isSuccess || !submit.isSuccess) {
      throw new Error('APDU tap exchange failed');
    }
  });

  // FEAT-07: Supabase Real-Time Ledger
  runCheck(1, 'FEAT-07', 'Atomic tap transfer debits payer and credits merchant correctly', () => {
    const ledger = new SimulatedLedger();
    ledger.createChargeSession({
      id: 'ch_ledger_01',
      amount: 100.0,
      merchantPhone: '04121234567',
      merchantName: 'Comercio Central',
    });
    const result = ledger.executeTapTransfer({
      sessionId: 'ch_ledger_01',
      payerPhone: '04149876543',
      reference: 'FT-0134-261011-B1C2D3-45',
      bankCode: 'banesco',
    });
    if (!result.success) throw new Error(`Transfer failed: ${result.error}`);
    if (result.newPayerBalance !== 400.0) throw new Error(`Expected payer balance 400, got ${result.newPayerBalance}`);
    if (result.newMerchantBalance !== 1100.0) throw new Error(`Expected merchant balance 1100, got ${result.newMerchantBalance}`);
  });

  // FEAT-08: Venezuelan Banking Reference Generator
  runCheck(1, 'FEAT-08', 'Banking reference generator produces SUDEBAN compliant FT code', () => {
    const ref = generateBankingReference({
      bankCode: 'banesco',
      sessionId: 'ch_ref_01',
      payerPhone: '04149876543',
      amount: 100.0,
    });
    const regex = /^FT-0134-\d{6}-[A-F0-9]{6}-\d{2}$/;
    if (!regex.test(ref)) throw new Error(`Reference format invalid: ${ref}`);
  });

  // FEAT-09: Automated APDU Test Harness
  runCheck(1, 'FEAT-09', 'Transceiver decomposes status words and raw bytes accurately', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    const resp = reader.transceive(buildSelectAidApdu());
    if (resp.sw1 !== 0x90 || resp.sw2 !== 0x00 || resp.swHex !== '9000') {
      throw new Error('Status word decomposition failed');
    }
  });

  // ==========================================================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================================================

  runCheck(2, 'FEAT-04', 'Reject payload exceeding 240B Short APDU limit with error', () => {
    const hce = new SimulatedHostApduService();
    let threw = false;
    try {
      hce.setPayload({
        sessionId: 'ch_overflow_test',
        amount: 50.0,
        currency: 'VES',
        merchantName: 'A'.repeat(250), // Over 240 bytes
      });
    } catch {
      threw = true;
    }
    if (!threw) throw new Error('Expected 240B overflow exception');
  });

  runCheck(2, 'FEAT-02', 'Foreign AID (Visa A0000000031010) rejected with 6A82', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    const foreignApdu = hexToBuffer('00A4040007A000000003101000');
    const resp = reader.transceive(foreignApdu);
    if (resp.swHex !== '6A82') throw new Error(`Expected 6A82, got ${resp.swHex}`);
  });

  runCheck(2, 'FEAT-04', 'GET_DETAILS before SELECT_AID returns 6985 Conditions Not Satisfied', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    hce.setPayload({ sessionId: 'ch_1', amount: 10, currency: 'USD', merchantName: 'M' });
    const resp = reader.transceive(buildGetDetailsApdu());
    if (resp.swHex !== '6985') throw new Error(`Expected 6985, got ${resp.swHex}`);
  });

  runCheck(2, 'FEAT-04', 'Unsupported CLA 0xFF returns 6E00 CLA Not Supported', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    reader.transceive(buildSelectAidApdu());
    const badCla = Buffer.from([0xff, 0x10, 0x00, 0x00, 0x00]);
    const resp = reader.transceive(badCla);
    if (resp.swHex !== '6E00') throw new Error(`Expected 6E00, got ${resp.swHex}`);
  });

  runCheck(2, 'FEAT-04', 'Unsupported INS 0x99 returns 6D00 INS Not Supported', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    reader.transceive(buildSelectAidApdu());
    const badIns = Buffer.from([0x80, 0x99, 0x00, 0x00, 0x00]);
    const resp = reader.transceive(badIns);
    if (resp.swHex !== '6D00') throw new Error(`Expected 6D00, got ${resp.swHex}`);
  });

  runCheck(2, 'FEAT-03', 'Simulated Link Loss throws TagLostException gracefully', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    hce.simulateLinkLoss();
    let threw = false;
    try {
      reader.transceive(buildSelectAidApdu());
    } catch (err: any) {
      if (err.message.includes('TagLostException')) threw = true;
    }
    if (!threw) throw new Error('Expected TagLostException on link loss');
  });

  runCheck(2, 'FEAT-03', 'Simulated Timeout throws TimeoutException when delay > 3500ms', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();
    reader.setTimeout(3500);
    reader.setArtificialDelay(4000); // 4000ms > 3500ms
    let threw = false;
    try {
      reader.transceive(buildSelectAidApdu());
    } catch (err: any) {
      if (err.message.includes('TimeoutException')) threw = true;
    }
    if (!threw) throw new Error('Expected TimeoutException');
  });

  runCheck(2, 'FEAT-07', 'Insufficient balance in Supabase ledger rejects transfer', () => {
    const ledger = new SimulatedLedger();
    ledger.createChargeSession({
      id: 'ch_expensive',
      amount: 999999.0, // More than 500.0 balance
      merchantPhone: '04121234567',
      merchantName: 'Luxury Store',
    });
    const result = ledger.executeTapTransfer({
      sessionId: 'ch_expensive',
      payerPhone: '04149876543',
      reference: 'FT-0102-261011-FFF111-99',
      bankCode: 'bdv',
    });
    if (result.success || result.error !== 'INSUFFICIENT_FUNDS') {
      throw new Error(`Expected INSUFFICIENT_FUNDS, got ${result.error}`);
    }
  });

  // ==========================================================================
  // TIER 3: Cross-Feature Combinations
  // ==========================================================================

  runCheck(3, 'CROSS-PAIR', 'Pairwise: Charge Session Creation -> HCE Arming -> IsoDep Reader Exchange', () => {
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);
    reader.connect();

    // 1. Merchant prepares charge session
    const payload = {
      type: 'CHARGE' as const,
      sessionId: 'ch_combo_301',
      amount: 275.5,
      currency: 'VES',
      merchantName: 'Automercado del Este',
      merchantPhone: '04121234567',
    };
    hce.setPayload(payload);

    // 2. Reader approaches and selects
    const selectResp = reader.transceive(buildSelectAidApdu());
    if (!selectResp.isSuccess) throw new Error('Select failed');

    // 3. Reader gets details
    const detailsResp = reader.transceive(buildGetDetailsApdu());
    if (!detailsResp.isSuccess) throw new Error('Get details failed');
    const received = JSON.parse(detailsResp.data.toString('utf8'));
    if (received.amount !== 275.5) throw new Error('Amount mismatch');
  });

  runCheck(3, 'CROSS-PAIR', 'Pairwise: Reader Capture -> Banking Reference Generator -> Ledger Settlement', () => {
    const ledger = new SimulatedLedger();
    const sessionId = 'ch_combo_302';
    const amount = 85.0;
    const payerPhone = '04149876543';

    ledger.createChargeSession({
      id: sessionId,
      amount,
      merchantPhone: '04121234567',
      merchantName: 'Farmacia 24H',
    });

    // Generate C2P reference
    const ref = generateBankingReference({
      bankCode: 'bdv',
      sessionId,
      payerPhone,
      amount,
    });

    // Execute transfer
    const res = ledger.executeTapTransfer({
      sessionId,
      payerPhone,
      reference: ref,
      bankCode: 'bdv',
    });

    if (!res.success) throw new Error('Transfer failed');
    if (res.reference !== ref) throw new Error('Reference mismatch');
  });

  // ==========================================================================
  // TIER 4: Real-World Scenarios
  // ==========================================================================

  runCheck(4, 'SCENARIO', 'Scenario 1: Full POS Merchant Checkout & Customer 1-Touch Tap Settlement', () => {
    const ledger = new SimulatedLedger();
    const hce = new SimulatedHostApduService();
    const reader = new SimulatedIsoDepTransceiver(hce);

    const sessionId = 'ch_pos_full_401';
    const amount = 220.0;
    const merchantPhone = '04121234567';
    const payerPhone = '04149876543';

    // Step 1: Merchant enters amount on POS keypad
    ledger.createChargeSession({
      id: sessionId,
      amount,
      merchantPhone,
      merchantName: 'Panaderia Francesa',
    });
    hce.setPayload({
      type: 'CHARGE',
      sessionId,
      amount,
      currency: 'VES',
      merchantName: 'Panaderia Francesa',
      merchantPhone,
    });

    // Step 2: Customer taps phone
    reader.connect();
    const sResp = reader.transceive(buildSelectAidApdu());
    const dResp = reader.transceive(buildGetDetailsApdu());
    const chargeInfo = JSON.parse(dResp.data.toString('utf8'));

    // Step 3: Payer generates reference & submits payment APDU
    const ref = generateBankingReference({
      bankCode: 'banesco',
      sessionId: chargeInfo.sessionId,
      payerPhone,
      amount: chargeInfo.amount,
    });
    const subResp = reader.transceive(
      buildSubmitPaymentApdu({
        payerPhone,
        payerName: 'Cliente Juan',
        reference: ref,
      })
    );
    if (!subResp.isSuccess) throw new Error('Submit payment failed');

    // Step 4: Atomic Supabase settlement
    const transferRes = ledger.executeTapTransfer({
      sessionId,
      payerPhone,
      reference: ref,
      bankCode: 'banesco',
    });
    if (!transferRes.success) throw new Error('Ledger settlement failed');

    // Step 5: Verification of final balances
    const pWallet = ledger.getWallet(payerPhone);
    const mWallet = ledger.getWallet(merchantPhone);
    if (pWallet?.balance !== 280.0) throw new Error(`Payer balance wrong: ${pWallet?.balance}`);
    if (mWallet?.balance !== 1220.0) throw new Error(`Merchant balance wrong: ${mWallet?.balance}`);
  });

  runCheck(4, 'SCENARIO', 'Scenario 2: Duplicate Tap Protection / Idempotency', () => {
    const ledger = new SimulatedLedger();
    const sessionId = 'ch_pos_dup_402';
    const payerPhone = '04149876543';

    ledger.createChargeSession({
      id: sessionId,
      amount: 50.0,
      merchantPhone: '04121234567',
      merchantName: 'Kiosco',
    });

    const ref = generateBankingReference({
      bankCode: 'bdv',
      sessionId,
      payerPhone,
      amount: 50.0,
    });

    // First Tap
    const r1 = ledger.executeTapTransfer({ sessionId, payerPhone, reference: ref, bankCode: 'bdv' });
    if (!r1.success) throw new Error('First tap failed');
    const balAfterFirst = ledger.getWallet(payerPhone)?.balance;

    // Second Tap (Accidental immediate double tap)
    const r2 = ledger.executeTapTransfer({ sessionId, payerPhone, reference: ref, bankCode: 'bdv' });
    if (!r2.success || !r2.alreadyPaid) throw new Error('Second tap was not marked alreadyPaid');
    const balAfterSecond = ledger.getWallet(payerPhone)?.balance;

    if (balAfterFirst !== balAfterSecond) {
      throw new Error(`Double debit occurred! First: ${balAfterFirst}, Second: ${balAfterSecond}`);
    }
  });

  // ==========================================================================
  // Report Summary
  // ==========================================================================

  console.log('Test Execution Results:');
  console.log('------------------------------------------------------------------------');
  
  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    const symbol = r.passed ? '✓' : '✗';
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`[Tier ${r.tier}] [${r.feature}] ${symbol} ${r.name} (${r.durationMs}ms)`);
    if (r.passed) {
      passedCount++;
    } else {
      failedCount++;
      console.log(`       Error: ${r.error}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${results.length})`);
  console.log('========================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
