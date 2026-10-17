# Test Infrastructure & Strategy: Fiscus Tap

## 1. Test Philosophy

Fiscus Tap implements direct phone-to-phone contactless payment and data exchange over real hardware NFC using Android Host Card Emulation (HCE, ISO 7816-4 Type 4 Tag Emulation) and IsoDep Reader Mode. Testing contactless NFC systems in continuous integration and automated environments presents unique challenges:
- Physical proximity between two hardware devices is impossible in headless cloud CI (GitHub Actions, containerized pipelines).
- Android emulators do not support peer-to-peer RF coupling or IsoDep cross-talk between two emulator instances.
- Android OS conflict elimination (category `other`, proprietary AID, foreground dispatch suppression) requires precise configuration validation.

To solve this without sacrificing test fidelity, the test infrastructure follows an **opaque-box, requirement-driven, hardware-free simulated IsoDep transceiver architecture**:
1. **Byte-Level Protocol Emulation**: Tests exercise real byte arrays (Command and Response APDUs, CLA, INS, P1, P2, Lc, Data, Le, SW1, SW2) exactly matching ISO/IEC 7816-4:2020 and NFC Forum Type 4 Tag standards.
2. **Deterministic State Machine**: The simulated `SimulatedHostApduService` and `SimulatedIsoDepTransceiver` maintain the exact lifecycle states of the native Android components (`isAidSelected`, `sessionNonce`, `activePayload`, connection teardown, and RF link loss).
3. **No Facade Tests**: Tests do not mock away business rules. They test real payload parsing, size limit enforcement (<240 bytes Short APDU), status word generation (`0x9000`, `0x6A82`, `0x6985`, `0x6D00`, `0x6E00`), and idempotent banking reference validation.
4. **Zero Physical Hardware Requirement**: 100% of the test suite runs in headless Node.js/TypeScript environments with zero physical dependencies.

---

## 2. Feature Inventory Mapping

The test suite covers the 9 features cataloged in `PROJECT.md`:

| # | Feature ID | Feature Name | Description & Invariants | Target Milestones | Authoritative Source |
|---|---|---|---|---|---|
| 1 | `FEAT-01` | Android HostApduService (HCE) | Native Android HCE service processing ISO 7816-4 APDUs, session state, and RF deactivation | M1 | `ORIGINAL_REQUEST §R1` |
| 2 | `FEAT-02` | OS Conflict Elimination | Elimination of Google Wallet popups & generic chooser via `category="other"`, proprietary AID `F046495343555301`, and `setPreferredService` | M1 | `ORIGINAL_REQUEST §R2` |
| 3 | `FEAT-03` | Android Reader Mode (IsoDep) | Low-level NFC reader with `FLAG_READER_NFC_A`, `SKIP_NDEF_CHECK`, `NO_PLATFORM_SOUNDS`, and 3500ms timeout | M1 | `ORIGINAL_REQUEST §R1, R2` |
| 4 | `FEAT-04` | ISO 7816-4 APDU Protocol | Command set (`SELECT_AID`, `GET_TRANSACTION_DETAILS`, `SUBMIT_PAYMENT_TRANSFER`, `ACK_CONFIRMATION`), Short APDU (<240B), and Status Words | M1 | `ORIGINAL_REQUEST §R3` |
| 5 | `FEAT-05` | Capacitor Plugin Bridge | Bidirectional native-to-web plugin (`FiscusNfcBridge`), in-process event bus (`HceEventBridge`), and web fallback (`FiscusNfcWeb`) | M2 | `ORIGINAL_REQUEST §R1` |
| 6 | `FEAT-06` | Real Hardware NFC Tap UI | Cobrar (merchant terminal) & Pagar (payer client) views; tap data exchange without QR code fallback | M3 | `ORIGINAL_REQUEST §R3, Criteria` |
| 7 | `FEAT-07` | Supabase Real-Time Ledger | Double-entry wallets, atomic stored procedure `execute_tap_transfer` with `FOR UPDATE` row locks, sub-120ms settlement | M4 | `ORIGINAL_REQUEST §R3, Criteria` |
| 8 | `FEAT-08` | Venezuelan Banking Reference Generator | SUDEBAN C2P reference format `FT-{BANK}-{YYMMDD}-{HEX}-{CHK}` with deterministic idempotency | M4 | `ORIGINAL_REQUEST §R3` |
| 9 | `FEAT-09` | Multi-Tier Automated APDU Test Harness | In-memory simulated transceiver, verification runner `scripts/verify-apdu.ts`, and CI test suites | E2E-Track / M5 | `ORIGINAL_REQUEST Criteria` |

---

## 3. Four-Tier Testing Methodology

The test suite is structured into 4 progressive tiers ensuring comprehensive validation from individual unit specifications up to end-to-end payment flows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Tier 4: Real-World Scenarios                          │
│   - End-to-end merchant checkout & customer 1-touch tap payment             │
│   - Venezuelan C2P banking reference generation & idempotency               │
│   - Ledger settlement & balance debit/credit accounting                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ builds upon
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Tier 3: Cross-Feature Combinations                        │
│   - Pairwise interaction: Charge Session Creation + HCE Emulation           │
│   - Pairwise interaction: HCE Emulation + Reader IsoDep Capture             │
│   - Pairwise interaction: Reader Capture + Supabase Atomic Ledger Sync      │
│   - Pairwise interaction: Banking Reference Generator + Ledger Idempotency  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ builds upon
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Tier 2: Boundary & Corner Cases                           │
│   - >= 5 test cases per feature (>= 45 tests total)                         │
│   - Max payload limits (240B threshold), empty amounts, boundary numbers    │
│   - Invalid/foreign AIDs (Visa, Mastercard, NDEF), unsupported CLA/INS      │
│   - Physical link loss (TagLostException), timeouts (3500ms), malformed data│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ builds upon
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Tier 1: Feature Coverage (Happy Path)                  │
│   - >= 5 test cases per feature across all 9 features (>= 45 tests total)   │
│   - Nominal SELECT_AID, GET_DETAILS, SUBMIT_PAYMENT, ACK_CONFIRMATION      │
│   - Nominal status words (0x9000), descriptor parsing, reference generation │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Tier 1: Feature Coverage (>= 5 tests per feature, >= 45 tests)
- **FEAT-01 (HostApduService)**: Service initialization, session nonce generation, protocol version output, role indication, clean deactivation reset.
- **FEAT-02 (OS Conflict Elimination)**: `category="other"` descriptor compliance, proprietary AID (`F046495343555301`) isolation, absence of payment category, absence of NDEF selector, `setPreferredService` binding.
- **FEAT-03 (Reader Mode)**: `FLAG_READER_NFC_A` filter, `FLAG_READER_SKIP_NDEF_CHECK` active, `FLAG_READER_NO_PLATFORM_SOUNDS` active, 3500ms timeout configuration, presence delay 250ms setting.
- **FEAT-04 (APDU Protocol)**: Canonical `SELECT_AID` exchange, `GET_TRANSACTION_DETAILS` exchange, `SUBMIT_PAYMENT_TRANSFER` exchange, `ACK_CONFIRMATION` exchange, valid `SW_SUCCESS` (0x9000) termination.
- **FEAT-05 (Capacitor Plugin Bridge)**: `isSupported()` contract, `startHceSession()` invocation, `stopHceSession()` cleanup, `startReaderMode()` invocation, event listener subscription and emission.
- **FEAT-06 (Real Hardware NFC Tap UI)**: Keypad amount entry, charge session creation, reader discovery event reception, confirmation receipt formatting, QR code absence verification.
- **FEAT-07 (Supabase Real-Time Ledger)**: Atomic transfer invocation, payer debit, merchant credit, transaction record insertion, double-spend prevention.
- **FEAT-08 (Venezuelan Banking Reference Generator)**: Prefix resolution for BDV (`0102`), Banesco (`0134`), Mercantil (`0105`), Provincial (`0108`), valid format regex `FT-\d{4}-\d{6}-[A-F0-9]{6}-\d{2}`.
- **FEAT-09 (Test Harness)**: Transceiver loopback connect, command transceive, status word decomposition, data payload extraction, timeout setter.

### 3.2. Tier 2: Boundary & Corner Cases (>= 5 tests per feature, >= 45 tests)
- **FEAT-01**: Consecutive deactivations, rapid session re-arming, null command APDU handling, short command (<4 bytes) handling, concurrent session access.
- **FEAT-02**: Foreign AID rejection (Visa `A0000000031010`), Mastercard AID rejection (`A0000000041010`), NDEF AID rejection (`D2760000850101`), partial prefix match rejection (`F046495343`), overlength AID rejection.
- **FEAT-03**: Reader timeout expiration (>3500ms), simulated link loss mid-connection (`TagLostException`), closed socket transceive attempt, reconnect after link loss, reader error propagation.
- **FEAT-04**: Payload boundary exactly 240 bytes, rejection of payload > 240 bytes (Short APDU overflow), unsupported CLA (`0xFF` -> `0x6E00`), unsupported INS (`0x99` -> `0x6D00`), unselected state command (`0x6985`).
- **FEAT-05**: Plugin call with null options, double startHceSession without stop, reader stop when not started, listener unsubscribe cleanup, empty payload handling.
- **FEAT-06**: Zero amount tap rejection, negative amount rejection, extreme amount (Bs. 100,000,000.00), unicode character in merchant name, rapid double-tap debounce.
- **FEAT-07**: Insufficient funds balance overdraft rejection, non-existent payer wallet, non-existent session ID, already-paid session idempotency, concurrent double-charge attempt.
- **FEAT-08**: Case-insensitive bank code resolution, empty bank code fallback, decimal precision variation (25 vs 25.00), non-ASCII character sanitization in seed, checksum boundary (00 to 99).
- **FEAT-09**: Disconnected transceiver error throw, malformed response (< 2 bytes), large buffer handling, zero-byte command array, status word formatting with leading zeroes.

### 3.3. Tier 3: Cross-Feature Combinations (Pairwise & Multi-Feature Interactions)
- **C-01 (Session + HCE)**: Web client creates charge session -> arms HCE service with JSON payload -> HCE stores active session and generates nonce.
- **C-02 (HCE + Reader)**: Armed HCE service + Reader Mode execute 2-round-trip APDU handshake (`SELECT_AID` -> `GET_DETAILS`) -> Reader extracts verified payload.
- **C-03 (Reader + Reference Generator)**: Reader receives charge payload -> invokes `generateBankingReference` -> generates valid SUDEBAN C2P reference code.
- **C-04 (Reference + Supabase Ledger)**: Generated reference is passed to `execute_tap_transfer` -> funds move atomically -> ledger record references exact code.
- **C-05 (Full Tap Pipeline)**: Charge Session -> HCE Arming -> IsoDep Transceive -> Reference Generation -> Ledger Settlement -> WebSocket Notification.

### 3.4. Tier 4: Real-World Scenarios (End-to-End User Journeys)
- **S-01 (Merchant POS Checkout & Customer Tap)**: Complete end-to-end checkout: Merchant enters amount on POS keypad, arms HCE session; Customer taps phone in Reader Mode; ISO 7816-4 APDU exchange completes in < 80ms; C2P reference generated; Supabase atomic ledger settles; Payer debited, Merchant credited; both devices display confirmation receipt with zero QR codes.
- **S-02 (Link Loss & Auto-Recovery)**: Customer approaches phone but pulls away after `SELECT_AID` before `GET_DETAILS`; system detects link loss (`TagLostException`), cleans up session state gracefully without financial debit; Customer taps again; transaction completes cleanly on second attempt.
- **S-03 (Insufficient Payer Balance Tap)**: Customer with Bs. 15.00 taps POS terminal requesting Bs. 150.00; APDU exchange transfers session details successfully; Supabase ledger evaluates funds and rejects with `INSUFFICIENT_FUNDS`; terminal and customer UI display polite error modal; zero balance modified.
- **S-04 (Duplicate Tap Protection / Idempotency)**: Customer accidentally double-taps phone within 500ms; first tap completes transfer; second tap detects existing paid session and returns identical reference without secondary debit; wallet balance reflects exactly single payment.

---

## 4. Test Execution & Reporting

- **Test Harness Implementation**: `scripts/lib/simulated-transceiver.ts`
- **Comprehensive Test Suite**: `test/e2e-apdu-tiers.test.ts`
- **CLI Verification Runner**: `scripts/verify-apdu.ts`
- **Runner Command**: `node --test test/e2e-apdu-tiers.test.ts` or `npm run test:apdu`
- **Published Report**: `TEST_READY.md`
