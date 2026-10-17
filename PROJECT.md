# Project: Fiscus Tap — Real Phone-to-Phone NFC Transfer (HCE)

## Architecture

Fiscus Tap combines a Next.js 14 / React 18 TypeScript web client with native Android Host Card Emulation (HCE) and Reader Mode via a custom Capacitor plugin bridge (`@fiscus/capacitor-nfc-hce`), backed by Supabase PostgreSQL for atomic ledger settlement and real-time transaction synchronization.

```
┌─────────────────────────────────────────────────────────────┐
│                 Next.js 14 Web Frontend                     │
│    - src/app/cobrar/page.tsx (Merchant POS Terminal)        │
│    - src/app/pagar/page.tsx  (Payer Radar & Tap)            │
│    - src/lib/wallet-store.ts (Encrypted Local State)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Capacitor Bridge IPC
                               ▼
┌─────────────────────────────────────────────────────────────┐
│        Capacitor Plugin: com.fiscus.tap.plugin              │
│    - FiscusNfcPlugin.java    - FiscusNfcBridge.ts           │
│    - HceEventBridge.java     - FiscusNfcWeb.ts (fallback)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Binder IPC                   │ RF Polling Loop
               ▼                              ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│  FiscusHceService (ISO 7816) ││ FiscusReaderCallback (IsoDep)│
│  - AID: F046495343555301     ││ - Short APDU Transceiver     │
│  - Category: other           ││ - Skip NDEF & No sounds flags│
│  - Short APDU (< 240 bytes)  ││ - Timeout: 3500ms            │
└──────────────┬───────────────┘└──────────────┬───────────────┘
               │                               │
               └───────────────┬───────────────┘
                               │ Hardware RF Tap
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase Realtime Settlement                │
│    - wallets & wallet_transactions tables                   │
│    - execute_tap_transfer (Atomic RPC with FOR UPDATE locks)│
│    - Deterministic Venezuelan Reference: FT-BANK-YYMMDD-HEX │
└─────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Android HostApduService (HCE) | Native Android HCE service implementing ISO 7816-4 and NFC Type 4 Tag emulation | M1 | ORIGINAL_REQUEST §R1 |
| 2 | OS Conflict Elimination | AndroidManifest + apduservice.xml with category="other", AID F046495343555301, and setPreferredService | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Android Reader Mode (IsoDep) | Low-level NFC reader with FLAG_READER_NFC_A, SKIP_NDEF, NO_PLATFORM_SOUNDS | M1 | ORIGINAL_REQUEST §R1, R2 |
| 4 | ISO 7816-4 APDU Protocol | SELECT_AID, GET_DETAILS, SUBMIT_PAYMENT with Short APDU (<240B) and status words (0x9000, 0x6A82) | M1 | ORIGINAL_REQUEST §R3 |
| 5 | Capacitor Plugin Bridge | Bidirectional native-to-web plugin (@fiscus/capacitor-nfc-hce) with HceEventBridge and Web fallback | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Real Hardware NFC Tap UI | Cobrar & Pagar integration; physical tap data exchange without QR code fallback | M3 | ORIGINAL_REQUEST §R3, Criteria |
| 7 | Supabase Real-Time Ledger | Extended SQL schema, atomic RPC execute_tap_transfer with row locks, sub-120ms settlement | M4 | ORIGINAL_REQUEST §R3, Criteria |
| 8 | Venezuelan Banking Reference Generator | SUDEBAN C2P compliant reference generator FT-{BANK}-{YYMMDD}-{HEX} | M4 | ORIGINAL_REQUEST §R3 |
| 9 | Multi-Tier Automated APDU Test Harness | Hardware-free simulated IsoDep transceiver, APDU validation runner (scripts/verify-apdu.ts) | E2E-Track / M5 | ORIGINAL_REQUEST Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Android Native HCE & Reader Foundation | Capacitor setup, AndroidManifest, apduservice.xml, FiscusHceService, ReaderMode, ApduProtocol | none | DONE |
| 2 | M2: Capacitor Plugin & Web Bridge Layer | FiscusNfcPlugin.java, HceEventBridge.java, FiscusNfcBridge.ts, web fallback | M1 | DONE |
| 3 | M3: UI Integration (Cobrar & Pagar) | Wire native NFC into Cobrar and Pagar views; eliminate QR as primary transfer | M2 | DONE |
| 4 | M4: Supabase Ledger & Banking Reference | SQL schema, atomic stored procedure, banking reference generator, real-time sync | M2 | DONE |
| 5 | M5: Final E2E Test Pass & Coverage Hardening | Pass 100% of Tiers 1-4 E2E tests, followed by Tier 5 Adversarial Coverage Hardening | M3, M4, E2E-Track | DONE |

## E2E Testing Track
| Track | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| E2E | E2E Testing Track | TEST_INFRA.md, simulated APDU transceiver, test runner, Tiers 1-4 test cases, TEST_READY.md | none | DONE |

## Interface Contracts

### M1 ↔ M2 (Android Native ↔ Capacitor Plugin)
- `HceEventBridge.getInstance().setActiveSession(String sessionId, byte[] payload)`
- `HceEventBridge.getInstance().clearActiveSession()`
- `HceEventBridge.getInstance().addListener(HceEventListener listener)`
- `FiscusReaderCallback.start(Activity activity, NfcAdapter adapter, int timeoutMs, HceEventListener listener)`
- `FiscusReaderCallback.stop(Activity activity, NfcAdapter adapter)`

### M2 ↔ M3 (Capacitor Plugin ↔ Web UI)
- `FiscusNfcBridge.isSupported(): Promise<{ supported: boolean, enabled: boolean, hceSupported: boolean }>`
- `FiscusNfcBridge.startHceSession(options: { role: 'charge', payload: TransactionPayload }): Promise<{ sessionId: string }>`
- `FiscusNfcBridge.stopHceSession(): Promise<void>`
- `FiscusNfcBridge.startReaderMode(options?: { timeoutMs?: number }): Promise<void>`
- `FiscusNfcBridge.stopReaderMode(): Promise<void>`
- `FiscusNfcBridge.addListener('onTagDiscovered', (data: { payload: TransactionPayload }) => void)`
- `FiscusNfcBridge.addListener('onHcePayloadSent', (data: { sessionId: string }) => void)`

### M3 / M4 (Payment Flow ↔ Supabase Ledger)
- `execute_tap_transfer(p_payer_id UUID, p_merchant_id UUID, p_amount NUMERIC, p_reference TEXT, p_bank_code TEXT)`
  - Returns: `{ success: boolean, transaction_id: UUID, new_payer_balance: NUMERIC, new_merchant_balance: NUMERIC, reference: TEXT }`
- Bank Reference Format: `FT-{BANK_CODE}-{YYMMDD}-{HEX_TOKEN}` (e.g. `FT-0102-261011-9A3F1B`)

## Code Layout
- `android/app/src/main/AndroidManifest.xml` — Android permissions, HCE service declaration
- `android/app/src/main/res/xml/apduservice.xml` — HCE metadata with category="other" and AID F046495343555301
- `android/app/src/main/java/com/fiscus/tap/plugin/` — Native Java plugin, HCE service, Reader callback, and APDU protocol
- `src/lib/nfc-bridge/` — TypeScript Capacitor bridge, types, and Web fallback
- `src/lib/banking-reference.ts` — SUDEBAN C2P reference generator
- `src/app/cobrar/page.tsx` — Terminal POS UI with HCE charge session integration
- `src/app/pagar/page.tsx` — Payer UI with IsoDep Reader mode integration
- `supabase/migrations/` — Atomic transfer RPC, ledger tables, and realtime publications
- `test/e2e/` & `scripts/` — Automated APDU verification test harness & runner
