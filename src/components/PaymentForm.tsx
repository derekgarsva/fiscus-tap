'use client';

import { useState, useEffect } from 'react';
import { BankProfile, Merchant, PaymentResult } from '@/types';
import { getProfile, saveProfile } from '@/lib/profile-manager';
import { getProvider } from '@/providers/registry';
import { getBankByCode } from '@/config/banks';
import { recordPayment } from '@/lib/wallet-store';

interface PaymentFormProps {
  bankCode: string;
  merchant: Merchant;
  amount: number;
  onComplete: (result: PaymentResult) => void;
  onBack: () => void;
  onChangeBank: () => void;
}

export function PaymentForm({
  bankCode,
  merchant,
  amount,
  onComplete,
  onBack,
  onChangeBank,
}: PaymentFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saveProfileCheck, setSaveProfileCheck] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const bank = getBankByCode(bankCode);
  const provider = getProvider(bankCode);
  const fields = provider?.getRequiredFields() ?? [];

  useEffect(() => {
    loadExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode]);

  async function loadExistingProfile() {
    setLoadingProfile(true);
    try {
      const profile = await getProfile(bankCode);
      if (profile) {
        setFormData({
          phone: profile.phone || '',
          document_type: profile.document_type || 'V',
          document_number: profile.document_number || '',
          ...(profile.holder_name ? { holder_name: profile.holder_name } : {}),
        });
        setProfileLoaded(true);
      } else {
        setFormData({ document_type: 'V' });
        setProfileLoaded(false);
      }
    } catch {
      setFormData({ document_type: 'V' });
      setProfileLoaded(false);
    }
    setLoadingProfile(false);
  }

  function updateField(name: string, value: string) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await provider.processPayment(
        {
          merchant_id: merchant.id,
          amount,
          currency: merchant.currency,
          bank_code: bankCode,
          status: 'pending',
        },
        formData
      );

      // Save profile if requested and not already saved
      if (saveProfileCheck && !profileLoaded) {
        await saveProfile(bankCode, {
          bank_code: bankCode,
          phone: formData.phone || '',
          document_type: (formData.document_type as BankProfile['document_type']) || 'V',
          document_number: formData.document_number || '',
          holder_name: formData.holder_name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Record in local wallet store
      recordPayment(amount, merchant.name, bankCode, result.reference || 'FT-REF');


      onComplete({ ...result, merchant_name: merchant.name });
    } catch (err) {
      onComplete({
        success: false,
        message: err instanceof Error ? err.message : 'Error procesando el pago',
        timestamp: new Date().toISOString(),
        bank_code: bankCode,
        amount,
        merchant_name: merchant.name,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const formattedAmount = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#1d1d1f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bank header card */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/[0.06] shadow-apple-sm">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm"
            style={{
              backgroundColor: bank?.color,
              color: bank?.text_color,
            }}
          >
            {bank?.short_name.substring(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-[#1d1d1f] text-[15px] tracking-[-0.01em]">
              {bank?.name}
            </div>
            <div className="text-[12px] text-[#86868b]">
              C2P Autofill {profileLoaded ? '· Datos listos' : '· Requiere datos'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onChangeBank}
          className="text-[13px] font-medium text-[#0071e3] hover:underline px-2 py-1"
        >
          Cambiar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Form Fields (Autofilled or Manual) */}
        <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-apple-card space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-black/[0.04]">
            <span className="text-[12px] font-medium text-[#86868b] uppercase tracking-[0.08em]">
              Datos de Autorización
            </span>
            {profileLoaded && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#34c759] bg-[#34c759]/10 px-2.5 py-0.5 rounded-full">
                ✓ Autofill activo
              </span>
            )}
          </div>

          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#86868b]">
                {field.label}
              </label>

              {field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                  className="w-full px-4 py-3 bg-[#f5f5f7] border border-black/[0.04] rounded-2xl text-[15px] text-[#1d1d1f] focus:outline-none focus:border-[#1d1d1f] transition-all"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name] || ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  maxLength={field.maxLength}
                  inputMode={
                    field.type === 'tel'
                      ? 'tel'
                      : field.type === 'number'
                      ? 'numeric'
                      : 'text'
                  }
                  className="w-full px-4 py-3 bg-[#f5f5f7] border border-black/[0.04] rounded-2xl text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#1d1d1f] transition-all font-mono"
                />
              )}
            </div>
          ))}

          {/* First use: checkbox to remember for next time */}
          {!profileLoaded && (
            <label className="flex items-start gap-3 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveProfileCheck}
                onChange={(e) => setSaveProfileCheck(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#1d1d1f] rounded"
              />
              <div className="text-[13px]">
                <span className="font-medium text-[#1d1d1f]">
                  Guardar perfil para este banco
                </span>
                <p className="text-[#86868b] text-[12px] mt-0.5">
                  La próxima vez este banco se rellenará automáticamente.
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Amount Summary */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/[0.06] text-[15px] shadow-sm">
          <span className="text-[#86868b]">Monto total</span>
          <span className="font-bold font-mono text-xl text-[#1d1d1f]">
            Bs. {formattedAmount}
          </span>
        </div>

        {/* 1-Touch Apple Pay Style CTA Button */}
        <div className="pt-2 space-y-2.5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl font-semibold text-[17px] tracking-[-0.022em] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-wait flex items-center justify-center gap-2.5 shadow-apple-card"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Autorizando con {bank?.short_name}...</span>
              </>
            ) : (
              <span>Pagar Bs. {formattedAmount} con 1 Toque</span>
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="w-full py-2.5 text-center text-[14px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
