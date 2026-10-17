import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  SimulatedHostApduService,
  SimulatedIsoDepTransceiver,
  CANONICAL_AID,
  buildSelectAidApdu,
  buildGetDetailsApdu,
  buildSubmitPaymentApdu,
  hexToBuffer,
  bufferToHex,
} from '../scripts/lib/simulated-transceiver';

describe('Adversarial Verification: OS Conflict Avoidance & Descriptors', () => {
  const rootDir = path.resolve(__dirname, '..');
  const apduXmlPath = path.join(rootDir, 'android/app/src/main/res/xml/apduservice.xml');
  const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
  const mainActivityPath = path.join(rootDir, 'android/app/src/main/java/com/fiscus/tap/MainActivity.java');
  const readerCallbackPath = path.join(rootDir, 'android/app/src/main/java/com/fiscus/tap/plugin/FiscusReaderCallback.java');
  const hceServicePath = path.join(rootDir, 'android/app/src/main/java/com/fiscus/tap/plugin/FiscusHceService.java');
  const apduProtocolPath = path.join(rootDir, 'android/app/src/main/java/com/fiscus/tap/plugin/ApduProtocol.java');

  // =========================================================================
  // 1. apduservice.xml Verification
  // =========================================================================
  describe('1. apduservice.xml Descriptor Integrity', () => {
    it('ADV-01: File exists and contains valid XML root host-apdu-service', () => {
      assert.ok(fs.existsSync(apduXmlPath), 'apduservice.xml must exist');
      const content = fs.readFileSync(apduXmlPath, 'utf8');
      assert.match(content, /<host-apdu-service\s+xmlns:android=/);
    });

    it('ADV-02: requireDeviceUnlock is explicitly set to false', () => {
      const content = fs.readFileSync(apduXmlPath, 'utf8');
      assert.match(content, /android:requireDeviceUnlock\s*=\s*"false"/);
    });

    it('ADV-03: Category is strictly "other" (not "payment")', () => {
      const content = fs.readFileSync(apduXmlPath, 'utf8');
      assert.match(content, /android:category\s*=\s*"other"/);
      assert.doesNotMatch(content, /android:category\s*=\s*"payment"/, 'Must NEVER use category payment');
    });

    it('ADV-04: AID filter strictly matches F046495343555301', () => {
      const content = fs.readFileSync(apduXmlPath, 'utf8');
      assert.match(content, /<aid-filter\s+android:name\s*=\s*"F046495343555301"\s*\/>/);
    });
  });

  // =========================================================================
  // 2. AndroidManifest.xml Verification
  // =========================================================================
  describe('2. AndroidManifest.xml Security & Permissions', () => {
    it('ADV-05: Declares android.permission.NFC and hardware features', () => {
      const content = fs.readFileSync(manifestPath, 'utf8');
      assert.match(content, /<uses-permission\s+android:name\s*=\s*"android.permission.NFC"\s*\/>/);
      assert.match(content, /<uses-feature\s+android:name\s*=\s*"android.hardware.nfc"\s+android:required\s*=\s*"true"\s*\/>/);
      assert.match(content, /<uses-feature\s+android:name\s*=\s*"android.hardware.nfc.hce"\s+android:required\s*=\s*"true"\s*\/>/);
    });

    it('ADV-06: FiscusHceService demands BIND_NFC_SERVICE and has host_apdu_service metadata', () => {
      const content = fs.readFileSync(manifestPath, 'utf8');
      assert.match(content, /android:permission\s*=\s*"android.permission.BIND_NFC_SERVICE"/);
      assert.match(content, /android:name\s*=\s*"android.nfc.cardemulation.action.HOST_APDU_SERVICE"/);
      assert.match(content, /android:resource\s*=\s*"@xml\/apduservice"/);
    });
  });

  // =========================================================================
  // 3. MainActivity.java Lifecycle Integration
  // =========================================================================
  describe('3. MainActivity.java Lifecycle & Foreground Priority', () => {
    it('ADV-07: onResume invokes CardEmulation.setPreferredService with FiscusHceService', () => {
      const content = fs.readFileSync(mainActivityPath, 'utf8');
      assert.match(content, /public\s+void\s+onResume\(\)/);
      assert.match(content, /CardEmulation\.getInstance\(adapter\)/);
      assert.match(content, /new\s+ComponentName\(this,\s*FiscusHceService\.class\)/);
      assert.match(content, /cardEmulation\.setPreferredService\(this,\s*component\)/);
    });

    it('ADV-08: onPause invokes CardEmulation.unsetPreferredService', () => {
      const content = fs.readFileSync(mainActivityPath, 'utf8');
      assert.match(content, /public\s+void\s+onPause\(\)/);
      assert.match(content, /cardEmulation\.unsetPreferredService\(this\)/);
    });
  });

  // =========================================================================
  // 4. FiscusReaderCallback.java ReaderMode Flags
  // =========================================================================
  describe('4. ReaderMode Flags & Options', () => {
    it('ADV-09: ReaderMode uses FLAG_READER_NFC_A | FLAG_READER_SKIP_NDEF_CHECK | FLAG_READER_NO_PLATFORM_SOUNDS', () => {
      const content = fs.readFileSync(readerCallbackPath, 'utf8');
      assert.match(content, /NfcAdapter\.FLAG_READER_NFC_A/);
      assert.match(content, /NfcAdapter\.FLAG_READER_SKIP_NDEF_CHECK/);
      assert.match(content, /NfcAdapter\.FLAG_READER_NO_PLATFORM_SOUNDS/);
      // Bitwise check: 0x0001 | 0x0080 | 0x0100 = 0x0181 (385)
      const expectedFlagMask = 0x0001 | 0x0080 | 0x0100;
      assert.strictEqual(expectedFlagMask, 385);
    });

    it('ADV-10: ReaderMode configures EXTRA_READER_PRESENCE_CHECK_DELAY = 250ms', () => {
      const content = fs.readFileSync(readerCallbackPath, 'utf8');
      assert.match(content, /NfcAdapter\.EXTRA_READER_PRESENCE_CHECK_DELAY,\s*250/);
    });
  });

  // =========================================================================
  // 5. APDU & AID Strict Encoding Validation
  // =========================================================================
  describe('5. AID Category F Structure & Nonce Entropy', () => {
    it('ADV-11: Canonical AID starts with F0 (Category F unreserved proprietary RID)', () => {
      assert.strictEqual(CANONICAL_AID.slice(0, 2), 'F0');
      const aidBuf = Buffer.from(CANONICAL_AID, 'hex');
      assert.strictEqual(aidBuf.length, 8);
      assert.strictEqual(aidBuf.subarray(1, 7).toString('ascii'), 'FISCUS');
      assert.strictEqual(aidBuf[7], 0x01);
    });

    it('ADV-12: Nonce byte structure and Java SecureRandom verification', () => {
      const hce = new SimulatedHostApduService();
      const reader = new SimulatedIsoDepTransceiver(hce);
      reader.connect();
      const resp = reader.transceive(buildSelectAidApdu());
      assert.strictEqual(resp.isSuccess, true);
      const nonce = hce.getSessionNonce();
      assert.strictEqual(nonce.length, 8);
      assert.ok(nonce.some((b) => b !== 0), 'Nonce must contain non-zero bytes');

      // Verify that the native Android FiscusHceService employs java.security.SecureRandom
      const javaHceContent = fs.readFileSync(hceServicePath, 'utf8');
      assert.match(javaHceContent, /import\s+java\.security\.SecureRandom;/);
      assert.match(javaHceContent, /private\s+final\s+SecureRandom\s+secureRandom\s*=\s*new\s+SecureRandom\(\);/);
      assert.match(javaHceContent, /secureRandom\.nextBytes\(sessionNonce\);/);
    });

    it('ADV-13: Multibyte UTF-8 characters (Venezuelan Bolívares & accents) within 240B limit', () => {
      const hce = new SimulatedHostApduService();
      const reader = new SimulatedIsoDepTransceiver(hce);
      reader.connect();

      const complexPayload = {
        sessionId: 'ch_ve_99',
        amount: 1450.5,
        currency: 'VES',
        symbol: 'Bs.',
        merchantName: 'Almacenes El Éxito C.A. — Caracas 🛒',
        note: 'Pago móvil P2P sin comisión bancaria'
      };

      const jsonBytes = Buffer.byteLength(JSON.stringify(complexPayload), 'utf8');
      assert.ok(jsonBytes <= 240, `Payload must fit in 240B, got ${jsonBytes}`);

      hce.setPayload(complexPayload);
      reader.transceive(buildSelectAidApdu());
      const detResp = reader.transceive(buildGetDetailsApdu());
      assert.strictEqual(detResp.isSuccess, true);

      const received = JSON.parse(detResp.data.toString('utf8'));
      assert.strictEqual(received.merchantName, 'Almacenes El Éxito C.A. — Caracas 🛒');
      assert.strictEqual(received.symbol, 'Bs.');
    });
  });
});
