'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Merchant, PaymentResult, UserProfile } from '@/types';
import { listProfiles } from '@/lib/profile-manager';
import { getUserProfile } from '@/lib/wallet-store';
import { MerchantHeader } from '@/components/MerchantHeader';
import { BankSelector } from '@/components/BankSelector';
import { AmountInput } from '@/components/AmountInput';
import { PaymentForm } from '@/components/PaymentForm';
import { PaymentConfirmation } from '@/components/PaymentConfirmation';
import { Receipt } from '@/components/Receipt';
import { Skeleton } from '@/components/ui/skeleton';

type FlowStep =
  | 'loading'
  | 'error'
  | 'amount'
  | 'bank-select'
  | 'payment-form'
  | 'confirmation';

export default function PaymentClient({ slug }: { slug: string }) {
  const [step, setStep] = useState<FlowStep>('loading');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string>('');
  const [savedBankCodes, setSavedBankCodes] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    initPage();
    recordTapEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function initPage() {
    // 1. Check local user onboarding
    const p = getUserProfile();
    setUserProfile(p);

    // 2. Load saved bank profiles
    try {
      const profiles = await listProfiles();
      setSavedBankCodes(Object.keys(profiles));
    } catch {}

    // 3. Fallback merchants for static client
    const fallbackMerchants: Record<string, Merchant> = {
      sharky: {
        id: 'fb-001',
        slug: 'sharky',
        name: 'SHARKY',
        default_amount: 250.0,
        currency: 'VES',
        active: true,
        created_at: new Date().toISOString(),
      },
      'cafeteria-central': {
        id: 'fb-002',
        slug: 'cafeteria-central',
        name: 'Cafetería Central',
        currency: 'VES',
        active: true,
        created_at: new Date().toISOString(),
      },
      demo: {
        id: 'fb-003',
        slug: 'demo',
        name: 'Demo Store',
        default_amount: 100.0,
        currency: 'VES',
        active: true,
        created_at: new Date().toISOString(),
      },
    };

    const targetMerchant = fallbackMerchants[slug] || {
      id: `m-${slug}`,
      slug,
      name: `Comercio ${slug}`,
      default_amount: 100.0,
      currency: 'VES',
      active: true,
      created_at: new Date().toISOString(),
    };

    setMerchant(targetMerchant);
    if (targetMerchant.default_amount) {
      setAmount(targetMerchant.default_amount);
      if (p?.is_onboarded && p.default_bank) {
        setSelectedBank(p.default_bank);
        setStep('payment-form');
      } else {
        setStep('bank-select');
      }
    } else {
      setStep('amount');
    }
  }

  async function recordTapEvent() {
    // No-op in offline/static mode
  }

  function handleAmountConfirmed(amt: number) {
    setAmount(amt);
    if (userProfile?.is_onboarded && userProfile.default_bank) {
      setSelectedBank(userProfile.default_bank);
      setStep('payment-form');
    } else {
      setStep('bank-select');
    }
  }

  function handleBankSelected(bankCode: string) {
    setSelectedBank(bankCode);
    setStep('payment-form');
  }

  function handlePaymentComplete(result: PaymentResult) {
    setPaymentResult(result);
    setStep('confirmation');
  }

  function handleBack() {
    if (step === 'payment-form') {
      setStep('bank-select');
    } else if (step === 'bank-select') {
      if (!merchant?.default_amount) setStep('amount');
    }
  }

  function handleNewPayment() {
    setSelectedBank(userProfile?.default_bank || '');
    setPaymentResult(null);
    setStep(merchant?.default_amount ? 'payment-form' : 'amount');
  }

  return (
    <main className="min-h-[100dvh] w-full max-w-md mx-auto flex flex-col justify-between py-6 px-5 pt-safe pb-safe overflow-x-hidden bg-[#fbfbfd] text-[#1d1d1f]">
      {/* Top Header / Fiscus Brand */}
      <div className="flex items-center justify-between pb-2">
        <Link
          href="/"
          className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
        >
          ‹ Mi Billetera
        </Link>
        <span className="text-[11px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Fiscus Tap NFC
        </span>
        <div className="w-12" />
      </div>

      {/* Main Flow State Container */}
      <div className="py-4">
        {/* Loading */}
        {step === 'loading' && (
          <div className="py-12 space-y-4">
            <Skeleton lines={4} avatar={true} label="Identificando comercio NFC..." />
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-black/[0.04] flex items-center justify-center text-2xl">
              ✕
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f]">
              Comercio no encontrado
            </h2>
            <p className="text-[#86868b] text-[14px]">{error}</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-3 rounded-2xl bg-[#1d1d1f] text-white text-[14px] font-medium"
            >
              Volver al inicio
            </Link>
          </div>
        )}

        {/* Amount Input (Variable Merchants) */}
        {step === 'amount' && merchant && (
          <div className="space-y-6 animate-fadeIn">
            <MerchantHeader
              name={merchant.name}
              amount={0}
              logoUrl={merchant.logo_url}
            />
            <AmountInput
              onConfirm={handleAmountConfirmed}
              currency={merchant.currency}
            />
          </div>
        )}

        {/* Bank Selection */}
        {step === 'bank-select' && merchant && (
          <div className="space-y-6 animate-fadeIn">
            <MerchantHeader
              name={merchant.name}
              amount={amount}
              logoUrl={merchant.logo_url}
            />
            <BankSelector
              onSelect={handleBankSelected}
              savedBanks={savedBankCodes}
              selectedBank={selectedBank}
            />
          </div>
        )}

        {/* Payment Form (1-Touch with Autofill) */}
        {step === 'payment-form' && merchant && (
          <div className="space-y-6 animate-fadeIn">
            <MerchantHeader
              name={merchant.name}
              amount={amount}
              logoUrl={merchant.logo_url}
            />
            <PaymentForm
              bankCode={selectedBank}
              merchant={merchant}
              amount={amount}
              onComplete={handlePaymentComplete}
              onBack={handleBack}
              onChangeBank={() => setStep('bank-select')}
            />
          </div>
        )}

        {/* Confirmation + Receipt */}
        {step === 'confirmation' && paymentResult && (
          <div className="space-y-4 animate-fadeIn">
            <PaymentConfirmation
              result={paymentResult}
              onNewPayment={handleNewPayment}
            />
            {paymentResult.success && <Receipt result={paymentResult} />}
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="text-center pt-8 pb-2">
        <span className="text-[11px] text-[#aeaeb2] tracking-[0.08em] uppercase">
          ⚡ Fiscus Tap · Pago Físico con 1 Toque
        </span>
      </footer>
    </main>
  );
}
