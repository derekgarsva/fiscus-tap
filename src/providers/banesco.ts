import { MockC2PProvider } from './mock-c2p';

/**
 * Banesco – Payment Adapter
 *
 * ⚠️ MOCK: This adapter simulates Banesco C2P processing.
 * Real integration requires a commercial contract and official sandbox.
 * The adapter interface will remain the same when connecting to the real API.
 */
export class BanescoProvider extends MockC2PProvider {
  constructor() {
    super('banesco', 'Banesco', 0.95);
  }
}
