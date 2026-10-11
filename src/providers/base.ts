import {
  FieldDefinition,
  PaymentIntent,
  PaymentProviderInterface,
  PaymentResult,
  PaymentStatus,
} from '@/types';

export abstract class BasePaymentProvider implements PaymentProviderInterface {
  abstract code: string;
  abstract name: string;

  abstract getRequiredFields(): FieldDefinition[];

  abstract processPayment(
    intent: PaymentIntent,
    formData: Record<string, string>
  ): Promise<PaymentResult>;

  async validatePayment(reference: string): Promise<PaymentStatus> {
    return {
      reference,
      status: 'confirmed',
      message: 'Pago verificado correctamente',
    };
  }

  protected generateReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `FT-${timestamp}-${random}`;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
