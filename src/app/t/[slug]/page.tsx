'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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

type FlowStep =
  | 'loading'
  | 'error'
  | 'amount'
  | 'bank-select'
  | 'payment-form'
  | 'confirmation';

export default function PaymentPage() {
  const params = useParams();
  const slug = params.slug as string;

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

    // 3. Fetch merchant or active charge session
    try {
      // First check if this slug is an active charge session from /api/charges/[id]
      const chargeRes = await fetch(`/api/charges/${slug}`);
      if (chargeRes.ok) {
        const chargeData = await chargeRes.json();
        if (chargeData.amount) {
          const m: Merchant = {
            id: chargeData.id,
            slug: chargeData.id,
            name: chargeData.merchant_name || 'Comercio Fiscus',
            default_amount: chargeData.amount,
            currency: chargeData.currency || 'VES',
            active: true,
            created_at: chargeData.created_at || new Date().toISOString(),
          };
          setMerchant(m);
          setAmount(chargeData.amount);

          // If user has default bank onboarded, jump directly to 1-touch payment form!
          if (p?.is_onboarded && p.default_bank) {
            setSelectedBank(p.default_bank);
            setStep('payment-form');
          } else {
            setStep('bank-select');
          }
          return;
        }
      }

      // Otherwise fetch merchant from /api/merchants/[slug]
      const res = await fetch(`/api/merchants/${slug}`);
      if (!res.ok) throw new Error('Comercio no encontrado');
      const data: Merchant = await res.json();
      setMerchant(data);

      if (data.default_amount) {
        setAmount(data.default_amount);
        // If user is onboarded, jump straight to 1-touch payment form!
        if (p?.is_onboarded && p.default_bank) {
          setSelectedBank(p.default_bank);
          setStep('payment-form');
        } else {
          setStep('bank-select');
        }
      } else {
        setStep('amount');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar comercio');
      setStep('error');
    }
  }

  async function recordTapEvent() {
    try {
      await fetch('/api/tap-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
    } catch {}
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
    <main className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col justify-between py-10 px-6 max-w-md mx-auto">
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
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-8 h-8 border-2 border-[#1d1d1f] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#86868b] text-[14px]">Identificando comercio NFC...</p>
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
