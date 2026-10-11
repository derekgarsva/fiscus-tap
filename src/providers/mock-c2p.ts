import { FieldDefinition, PaymentIntent, PaymentResult } from '@/types';
import { BasePaymentProvider } from './base';

/**
 * Mock C2P (Comercio a Persona) Provider
 *
 * Simulates the C2P payment flow used by Venezuelan banks.
 * All bank-specific adapters extend this mock for development/testing.
 *
 * ⚠️ MOCK: This does NOT connect to any real banking API.
 */
export class MockC2PProvider extends BasePaymentProvider {
  code = 'mock-c2p';
  name = 'Mock C2P (Pruebas)';

  private successRate: number;

  constructor(
    code: string = 'mock-c2p',
    name: string = 'Mock C2P',
    successRate: number = 0.95
  ) {
    super();
    this.code = code;
    this.name = name;
    this.successRate = successRate;
  }

  getRequiredFields(): FieldDefinition[] {
    return [
      {
        name: 'phone',
        label: 'Teléfono',
        type: 'tel',
        placeholder: '0412-1234567',
        required: true,
        pattern: '^(0[0-9]{3})-?([0-9]{7})$',
        maxLength: 12,
      },
      {
        name: 'document_type',
        label: 'Tipo de documento',
        type: 'select',
        required: true,
        options: [
          { value: 'V', label: 'V - Venezolano' },
          { value: 'E', label: 'E - Extranjero' },
          { value: 'J', label: 'J - Jurídico' },
          { value: 'P', label: 'P - Pasaporte' },
        ],
      },
      {
        name: 'document_number',
        label: 'Número de documento',
        type: 'text',
        placeholder: '12345678',
        required: true,
        pattern: '^[0-9]{6,10}$',
        maxLength: 10,
      },
    ];
  }

  async processPayment(
    intent: PaymentIntent,
    _formData: Record<string, string>
  ): Promise<PaymentResult> {
    // Simulate processing delay (2-3 seconds)
    await this.delay(2000 + Math.random() * 1000);

    const success = Math.random() < this.successRate;
    const reference = this.generateReference();

    if (success) {
      return {
        success: true,
        reference,
        message: 'Pago procesado exitosamente',
        timestamp: new Date().toISOString(),
        bank_code: this.code,
        amount: intent.amount,
      };
    } else {
      return {
        success: false,
        message: 'Error de conexión con el banco. Intente nuevamente.',
        timestamp: new Date().toISOString(),
        bank_code: this.code,
        amount: intent.amount,
      };
    }
  }
}
