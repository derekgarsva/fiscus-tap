export interface Merchant {
  id: string;
  slug: string;
  name: string;
  logo_url?: string;
  default_amount?: number;
  currency: string;
  active: boolean;
  created_at: string;
}

export interface BankProfile {
  bank_code: string;
  phone: string;
  document_type: 'V' | 'E' | 'J' | 'P';
  document_number: string;
  holder_name?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  name: string;
  phone: string;
  document_type: 'V' | 'E' | 'J' | 'P';
  document_number: string;
  default_bank: string;
  pin: string;
  is_onboarded: boolean;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  type: 'payment_sent' | 'payment_received' | 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  title: string;
  subtitle?: string;
  bank_code?: string;
  reference: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface ChargeSession {
  id: string;
  merchant_name: string;
  merchant_phone?: string;
  amount: number;
  currency: string;
  status: 'waiting' | 'paid' | 'expired';
  paid_at?: string;
  reference?: string;
  bank_code?: string;
  payer_name?: string;
  created_at: string;
}

export interface PaymentIntent {
  id?: string;
  merchant_id: string;
  amount: number;
  currency: string;
  bank_code: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference?: string;
  created_at?: string;
  completed_at?: string;
}

export interface PaymentResult {
  success: boolean;
  reference?: string;
  message: string;
  timestamp: string;
  bank_code: string;
  amount: number;
  merchant_name?: string;
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'tel' | 'number' | 'select';
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  pattern?: string;
  maxLength?: number;
}

export interface PaymentProviderInterface {
  code: string;
  name: string;
  getRequiredFields(): FieldDefinition[];
  processPayment(intent: PaymentIntent, formData: Record<string, string>): Promise<PaymentResult>;
  validatePayment(reference: string): Promise<PaymentStatus>;
}

export interface PaymentStatus {
  reference: string;
  status: 'confirmed' | 'pending' | 'failed' | 'unknown';
  message: string;
}

export interface TapEvent {
  id?: string;
  merchant_id: string;
  user_agent?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface BankConfig {
  code: string;
  name: string;
  short_name: string;
  color: string;
  text_color: string;
  icon?: string;
  enabled: boolean;
}
