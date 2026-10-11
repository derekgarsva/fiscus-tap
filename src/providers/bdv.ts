import { MockC2PProvider } from './mock-c2p';

/**
 * Banco de Venezuela (BDV) – Payment Adapter
 *
 * ⚠️ MOCK: This adapter simulates BDV C2P processing.
 * Real integration requires a commercial contract and official sandbox.
 * The adapter interface will remain the same when connecting to the real API.
 */
export class BDVProvider extends MockC2PProvider {
  constructor() {
    super('bdv', 'Banco de Venezuela', 0.95);
  }
}
