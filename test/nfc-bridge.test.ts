import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FiscusNfcWeb } from '../src/lib/nfc-bridge/FiscusNfcWeb';
import { FiscusNfc, FiscusNfcBridge } from '../src/lib/nfc-bridge/FiscusNfcBridge';
import type {
  TransactionPayload,
  HceSessionOptions,
  NfcTagDiscoveredEvent,
  HcePayloadSentEvent,
} from '../src/lib/nfc-bridge/types';

describe('Milestone 2 Verification: FiscusNfcWeb Unit Tests', () => {
  let webPlugin: FiscusNfcWeb;

  beforeEach(() => {
    webPlugin = new FiscusNfcWeb();
  });

  // --------------------------------------------------------------------------
  // 1. Hardware & Status Checks
  // --------------------------------------------------------------------------
  describe('1. Hardware & Status Checks', () => {
    it('TC-M2-01: isSupported returns full hardware capability flags', async () => {
      const status = await webPlugin.isSupported();
      assert.strictEqual(typeof status.supported, 'boolean');
      assert.strictEqual(typeof status.enabled, 'boolean');
      assert.strictEqual(typeof status.hceSupported, 'boolean');
      assert.strictEqual(status.supported, true);
      assert.strictEqual(status.enabled, true);
      assert.strictEqual(status.hceSupported, true);
    });

    it('TC-M2-02: openNfcSettings resolves cleanly', async () => {
      await assert.doesNotReject(async () => {
        await webPlugin.openNfcSettings();
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. HCE Session Management
  // --------------------------------------------------------------------------
  describe('2. HCE Session Management', () => {
    it('TC-M2-03: startHceSession arms session and returns valid sessionId', async () => {
      const options: HceSessionOptions = {
        sessionId: 'ch_test_101',
        amount: 150.0,
        currency: 'VES',
        merchantName: 'Arepera Central',
        merchantPhone: '04141234567',
      };

      const result = await webPlugin.startHceSession(options);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.sessionId, 'ch_test_101');
    });

    it('TC-M2-03b: startHceSession synthesizes sessionId if omitted', async () => {
      const options: HceSessionOptions = {
        amount: 75.0,
        currency: 'VES',
        merchantName: 'Farmacia Sol',
      };

      const result = await webPlugin.startHceSession(options);
      assert.strictEqual(result.success, true);
      assert.ok(result.sessionId && result.sessionId.length > 0);
    });

    it('TC-M2-04: startHceSession rejects or handles payloads exceeding 240B limit', async () => {
      const oversizedPayload = {
        sessionId: 'ch_oversized_session_stress_test_id_999999999999999999999999',
        merchantName: 'A'.repeat(200),
        amount: 999999.99,
        currency: 'VES',
        notes: 'Excessive debug text that pushes payload past Short APDU limit of 240 bytes',
      };

      await assert.rejects(
        async () => {
          await webPlugin.startHceSession(oversizedPayload as any);
        },
        /PAYLOAD_TOO_LARGE|exceeds/i
      );
    });

    it('TC-M2-05: stopHceSession disarms active session and is idempotent', async () => {
      await webPlugin.startHceSession({
        sessionId: 'ch_stop_test',
        amount: 50.0,
        currency: 'VES',
        merchantName: 'Panadería',
      });

      const res1 = await webPlugin.stopHceSession();
      assert.strictEqual(res1.success, true);

      // Calling stop again should not throw
      const res2 = await webPlugin.stopHceSession();
      assert.strictEqual(res2.success, true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Reader Mode Management
  // --------------------------------------------------------------------------
  describe('3. Reader Mode Management', () => {
    it('TC-M2-06: startReaderMode activates reader mode with default or custom timeout', async () => {
      const res = await webPlugin.startReaderMode({ timeoutMs: 4000 });
      assert.strictEqual(res.success, true);
    });

    it('TC-M2-07: stopReaderMode deactivates reader mode and is idempotent', async () => {
      await webPlugin.startReaderMode();
      const res1 = await webPlugin.stopReaderMode();
      assert.strictEqual(res1.success, true);

      const res2 = await webPlugin.stopReaderMode();
      assert.strictEqual(res2.success, true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Event Subscriptions & Simulated Tap Handling
  // --------------------------------------------------------------------------
  describe('4. Event Subscriptions & Simulated Tap Handling', () => {
    it('TC-M2-08 & TC-M2-10: simulateTapEvent triggers onTagDiscovered and onHcePayloadSent', async () => {
      let tagDiscoveredData: any = null;
      let payloadSentData: any = null;

      const handleTag = await webPlugin.addListener('onTagDiscovered', (data) => {
        tagDiscoveredData = data;
      });

      const handleHce = await webPlugin.addListener('onHcePayloadSent', (data) => {
        payloadSentData = data;
      });

      // Arm HCE session
      await webPlugin.startHceSession({
        sessionId: 'ch_tap_sync_1',
        amount: 250.0,
        currency: 'VES',
        merchantName: 'Bodega El Ávila',
        merchantPhone: '04129876543',
      });

      // Start reader
      await webPlugin.startReaderMode();

      // Trigger simulation
      webPlugin.simulateTapEvent({
        sessionId: 'ch_tap_sync_1',
        amount: 250.0,
        currency: 'VES',
        merchantName: 'Bodega El Ávila',
        merchantPhone: '04129876543',
      });

      assert.ok(tagDiscoveredData, 'onTagDiscovered should have fired');
      assert.strictEqual(tagDiscoveredData.payload.sessionId, 'ch_tap_sync_1');
      assert.strictEqual(tagDiscoveredData.payload.amount, 250.0);

      assert.ok(payloadSentData, 'onHcePayloadSent should have fired');
      assert.strictEqual(payloadSentData.sessionId, 'ch_tap_sync_1');
      assert.ok(payloadSentData.bytesTransferred > 0);

      await handleTag.remove();
      await handleHce.remove();
    });

    it('TC-M2-09 & TC-M2-11: Alias event names fire identical data', async () => {
      let aliasTagFired = false;
      let aliasHceFired = false;

      const h1 = await webPlugin.addListener('nfcTagDiscovered' as any, () => {
        aliasTagFired = true;
      });
      const h2 = await webPlugin.addListener('hcePayloadSent' as any, () => {
        aliasHceFired = true;
      });

      await webPlugin.startHceSession({ sessionId: 'ch_alias', amount: 10, currency: 'VES', merchantName: 'Kiosk' });
      await webPlugin.startReaderMode();
      webPlugin.simulateTapEvent({ sessionId: 'ch_alias', amount: 10, currency: 'VES', merchantName: 'Kiosk' });

      assert.strictEqual(aliasTagFired, true);
      assert.strictEqual(aliasHceFired, true);

      await h1.remove();
      await h2.remove();
    });

    it('TC-M2-12: handle.remove() prevents future callback invocations', async () => {
      let invocationCount = 0;
      const handle = await webPlugin.addListener('onTagDiscovered', () => {
        invocationCount++;
      });

      await webPlugin.startReaderMode();
      webPlugin.simulateTapEvent({ sessionId: 's1', amount: 10, currency: 'VES', merchantName: 'M' });
      assert.strictEqual(invocationCount, 1);

      // Unsubscribe
      await handle.remove();

      webPlugin.simulateTapEvent({ sessionId: 's2', amount: 20, currency: 'VES', merchantName: 'M' });
      assert.strictEqual(invocationCount, 1, 'Callback must not be invoked after removal');
    });

    it('TC-M2-13: removeAllListeners removes all active subscriptions', async () => {
      let tagCount = 0;
      let hceCount = 0;

      await webPlugin.addListener('onTagDiscovered', () => { tagCount++; });
      await webPlugin.addListener('onHcePayloadSent', () => { hceCount++; });

      await webPlugin.startHceSession({ sessionId: 's1', amount: 10, currency: 'VES', merchantName: 'M' });
      await webPlugin.startReaderMode();

      await webPlugin.removeAllListeners();

      webPlugin.simulateTapEvent({ sessionId: 's1', amount: 10, currency: 'VES', merchantName: 'M' });
      assert.strictEqual(tagCount, 0);
      assert.strictEqual(hceCount, 0);
    });

    it('TC-M2-14: simulateReaderError dispatches onReaderError event', async () => {
      let errorReceived: any = null;
      const handle = await webPlugin.addListener('onReaderError', (err) => {
        errorReceived = err;
      });

      webPlugin.simulateReaderError('TAG_LOST', 'NFC link interrupted');
      assert.ok(errorReceived);
      assert.strictEqual(errorReceived.code, 'TAG_LOST');
      assert.strictEqual(errorReceived.message, 'NFC link interrupted');

      await handle.remove();
    });

    it('TC-M2-15: simulateDeactivation dispatches onHceDeactivated event', async () => {
      let deactReceived: any = null;
      const handle = await webPlugin.addListener('onHceDeactivated', (data) => {
        deactReceived = data;
      });

      webPlugin.simulateDeactivation(0);
      assert.ok(deactReceived);
      assert.strictEqual(deactReceived.reason, 0);

      await handle.remove();
    });

    it('TC-M2-16 & TC-M2-17: Inactive guards suppress callbacks when modes are off', async () => {
      let tagFired = false;
      let hceFired = false;

      await webPlugin.addListener('onTagDiscovered', () => { tagFired = true; });
      await webPlugin.addListener('onHcePayloadSent', () => { hceFired = true; });

      // Reader is NOT started, HCE is NOT armed
      webPlugin.simulateTapEvent({ sessionId: 's_guarded', amount: 10, currency: 'VES', merchantName: 'M' });

      assert.strictEqual(tagFired, false, 'Tag must not fire if reader mode is inactive');
      assert.strictEqual(hceFired, false, 'Payload sent must not fire if HCE session is not armed');
    });
  });
});

// ============================================================================
// 5. Bridge Proxy & Integration Tests
// ============================================================================
describe('Milestone 2 Verification: FiscusNfcBridge Integration Tests', () => {
  it('TC-M2-18 & TC-M2-19: FiscusNfc and FiscusNfcBridge export contract parity', async () => {
    assert.ok(FiscusNfc, 'FiscusNfc must be exported');
    assert.ok(FiscusNfcBridge, 'FiscusNfcBridge must be exported');
    assert.strictEqual(FiscusNfc, FiscusNfcBridge, 'FiscusNfc and FiscusNfcBridge must be identical');

    const status = await FiscusNfcBridge.isSupported();
    assert.strictEqual(typeof status.supported, 'boolean');
  });

  it('TC-M2-20: Full End-to-End POS-to-Payer Payment Handshake via Bridge', async () => {
    let payerReceivedSessionId = '';
    let merchantBytesTransferred = 0;

    // Merchant POS arms session
    const hceResult = await FiscusNfcBridge.startHceSession({
      sessionId: 'cs_pos_e2e_88',
      amount: 420.50,
      currency: 'VES',
      merchantName: 'Restaurante Caracas',
      merchantPhone: '04161112233',
    });
    assert.strictEqual(hceResult.success, true);

    const merchantSub = await FiscusNfcBridge.addListener('onHcePayloadSent', (evt) => {
      merchantBytesTransferred = evt.bytesTransferred;
    });

    // Payer activates reader
    await FiscusNfcBridge.startReaderMode({ timeoutMs: 3500 });

    const payerSub = await FiscusNfcBridge.addListener('onTagDiscovered', (evt) => {
      payerReceivedSessionId = evt.payload.sessionId;
    });

    // Web simulation helper trigger
    const webInstance = (FiscusNfcBridge as any);
    if (typeof webInstance.simulateTapEvent === 'function') {
      webInstance.simulateTapEvent({
        sessionId: 'cs_pos_e2e_88',
        amount: 420.50,
        currency: 'VES',
        merchantName: 'Restaurante Caracas',
        merchantPhone: '04161112233',
      });
    }

    assert.strictEqual(payerReceivedSessionId, 'cs_pos_e2e_88');
    assert.ok(merchantBytesTransferred > 0);

    // Teardown
    await FiscusNfcBridge.stopReaderMode();
    await FiscusNfcBridge.stopHceSession();
    await merchantSub.remove();
    await payerSub.remove();
  });

  it('TC-M2-21: Rapid sequential start/stop cycles do not throw or leak state', async () => {
    for (let i = 0; i < 5; i++) {
      await FiscusNfcBridge.startReaderMode();
      await FiscusNfcBridge.stopReaderMode();
      await FiscusNfcBridge.startHceSession({ sessionId: `s_${i}`, amount: 10, currency: 'VES', merchantName: 'M' });
      await FiscusNfcBridge.stopHceSession();
    }
  });

  it('TC-M2-22: Node.js evaluation safety (SSR compatibility)', () => {
    // Verifies that importing the bridge in this test environment (Node.js without native Android)
    // did not encounter ReferenceError or throw uncaught exceptions.
    assert.ok(FiscusNfcBridge);
  });
});
