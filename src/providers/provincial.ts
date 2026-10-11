import { MockC2PProvider } from './mock-c2p';

/**
 * BBVA Provincial – Payment Adapter
 *
 * ⚠️ MOCK: This adapter simulates Provincial C2P processing.
 * Real integration requires a commercial contract and official sandbox.
 * The adapter interface will remain the same when connecting to the real API.
 */
export class ProvincialProvider extends MockC2PProvider {
  constructor() {
    super('provincial', 'BBVA Provincial', 0.95);
  }
}
