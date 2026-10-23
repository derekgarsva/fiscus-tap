'use client';

import { UserProfile, WalletTransaction } from '@/types';
import { saveProfile } from './profile-manager';

const USER_PROFILE_KEY = 'fiscus_user_profile_v1';
const WALLET_BALANCE_KEY = 'fiscus_wallet_balance_v1';
const TRANSACTIONS_KEY = 'fiscus_wallet_txs_v1';

const INITIAL_BALANCE = 1450.00;

const DEFAULT_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-today-01',
    type: 'payment_sent',
    amount: 6.00,
    currency: 'SGD',
    title: 'Coffee',
    subtitle: 'Food & Drink · Registro Rápido',
    bank_code: 'receipt',
    reference: 'REC-CF-1002',
    timestamp: new Date().toISOString(),
    status: 'completed',
  },
  {
    id: 'tx-today-02',
    type: 'payment_sent',
    amount: 14.50,
    currency: 'SGD',
    title: 'Taxi to Office',
    subtitle: 'Transport · Registro Rápido',
    bank_code: 'receipt',
    reference: 'REC-TX-3091',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'completed',
  },
  {
    id: 'tx-welcome-01',
    type: 'deposit',
    amount: 1450.00,
    currency: 'VES',
    title: 'Recarga Inicial',
    subtitle: 'Pago Móvil C2P Fiscus',
    bank_code: 'banesco',
    reference: 'FT-INI-89210',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'completed',
  },
];

export function getUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));

  // Sync to bank profile manager so all bank adapters get autofilled
  await saveProfile(profile.default_bank, {
    bank_code: profile.default_bank,
    phone: profile.phone,
    document_type: profile.document_type,
    document_number: profile.document_number,
    holder_name: profile.name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export function getWalletBalance(): number {
  if (typeof window === 'undefined') return INITIAL_BALANCE;
  try {
    const raw = localStorage.getItem(WALLET_BALANCE_KEY);
    if (raw === null) {
      localStorage.setItem(WALLET_BALANCE_KEY, String(INITIAL_BALANCE));
      return INITIAL_BALANCE;
    }
    return parseFloat(raw) || 0;
  } catch {
    return INITIAL_BALANCE;
  }
}

export function getTransactions(): WalletTransaction[] {
  if (typeof window === 'undefined') return DEFAULT_TRANSACTIONS;
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(DEFAULT_TRANSACTIONS));
      return DEFAULT_TRANSACTIONS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TRANSACTIONS;
  }
}

export function addFunds(
  amount: number,
  bankCode: string,
  reference: string
): { balance: number; tx: WalletTransaction } {
  const current = getWalletBalance();
  const next = current + amount;
  localStorage.setItem(WALLET_BALANCE_KEY, String(next));

  const tx: WalletTransaction = {
    id: `tx-dep-${Date.now()}`,
    type: 'deposit',
    amount,
    currency: 'VES',
    title: 'Ingreso de Fondos',
    subtitle: `Pago Móvil C2P (${bankCode.toUpperCase()})`,
    bank_code: bankCode,
    reference,
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  const txs = [tx, ...getTransactions()];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));

  return { balance: next, tx };
}

export function withdrawFunds(
  amount: number,
  bankCode: string
): { success: boolean; balance: number; tx?: WalletTransaction; message?: string } {
  const current = getWalletBalance();
  if (amount > current) {
    return { success: false, balance: current, message: 'Fondos insuficientes' };
  }

  const next = current - amount;
  localStorage.setItem(WALLET_BALANCE_KEY, String(next));

  const tx: WalletTransaction = {
    id: `tx-wd-${Date.now()}`,
    type: 'withdrawal',
    amount,
    currency: 'VES',
    title: 'Retiro a Cuenta Bancaria',
    subtitle: `Transferencia a ${bankCode.toUpperCase()}`,
    bank_code: bankCode,
    reference: `RET-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  const txs = [tx, ...getTransactions()];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));

  return { success: true, balance: next, tx };
}

export function recordPayment(
  amount: number,
  merchantName: string,
  bankCode: string,
  reference: string
): WalletTransaction {
  const current = getWalletBalance();
  const next = Math.max(0, current - amount);
  localStorage.setItem(WALLET_BALANCE_KEY, String(next));

  const tx: WalletTransaction = {
    id: `tx-pay-${Date.now()}`,
    type: 'payment_sent',
    amount,
    currency: 'VES',
    title: merchantName,
    subtitle: `Pago con 1 toque (${bankCode.toUpperCase()})`,
    bank_code: bankCode,
    reference,
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  const txs = [tx, ...getTransactions()];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));
  return tx;
}

export function recordCollection(
  amount: number,
  payerName: string,
  bankCode: string,
  reference: string
): WalletTransaction {
  const current = getWalletBalance();
  const next = current + amount;
  localStorage.setItem(WALLET_BALANCE_KEY, String(next));

  const tx: WalletTransaction = {
    id: `tx-col-${Date.now()}`,
    type: 'payment_received',
    amount,
    currency: 'VES',
    title: `Cobro a ${payerName || 'Cliente'}`,
    subtitle: `Recibido con Tap (${bankCode.toUpperCase()})`,
    bank_code: bankCode,
    reference,
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  const txs = [tx, ...getTransactions()];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));
  return tx;
}

export function recordExpense(
  amount: number,
  description: string,
  category: string,
  currency = 'VES'
): { balance: number; tx: WalletTransaction } {
  const current = getWalletBalance();
  const next = Math.max(0, current - amount);
  localStorage.setItem(WALLET_BALANCE_KEY, String(next));

  const tx: WalletTransaction = {
    id: `tx-exp-${Date.now()}`,
    type: 'payment_sent',
    amount,
    currency,
    title: description,
    subtitle: `${category} · Registro Rápido`,
    bank_code: 'receipt',
    reference: `REC-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  const txs = [tx, ...getTransactions()];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txs));
  return { balance: next, tx };
}

export function resetWallet(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_PROFILE_KEY);
  localStorage.removeItem(WALLET_BALANCE_KEY);
  localStorage.removeItem(TRANSACTIONS_KEY);
}
