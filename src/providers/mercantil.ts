import { MockC2PProvider } from './mock-c2p';

/**
 * Mercantil – Payment Adapter
 *
 * ⚠️ MOCK: This adapter simulates Mercantil C2P processing.
 * Real integration requires a commercial contract and official sandbox.
 * The adapter interface will remain the same when connecting to the real API.
 */
export class MercantilProvider extends MockC2PProvider {
  constructor() {
    super('mercantil', 'Mercantil', 0.95);
  }
}
