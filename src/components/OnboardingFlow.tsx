'use client';

import { useState } from 'react';
import { UserProfile } from '@/types';
import { getEnabledBanks } from '@/config/banks';
import { saveUserProfile } from '@/lib/wallet-store';

interface OnboardingFlowProps {
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [name, setName] = useState('');
  const [docType, setDocType] = useState<'V' | 'E' | 'J' | 'P'>('V');
  const [docNumber, setDocNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedBank, setSelectedBank] = useState('banesco');
  const [pin, setPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const banks = getEnabledBanks();

  const isStep1Valid = name.trim().length >= 3 && docNumber.trim().length >= 6 && phone.trim().length >= 10;
  const isStep2Valid = Boolean(selectedBank);
  const isStep3Valid = pin.length === 4;

  async function handleFinish() {
    setIsSaving(true);
    const profile: UserProfile = {
      name: name.trim(),
      phone: phone.trim(),
      document_type: docType,
      document_number: docNumber.trim(),
      default_bank: selectedBank,
      pin,
      is_onboarded: true,
      created_at: new Date().toISOString(),
    };

    await saveUserProfile(profile);
    setIsSaving(false);
    onComplete(profile);
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex flex-col justify-between py-12 px-6 max-w-lg mx-auto">
      {/* Top Header / Apple Brand */}
      <div className="text-center space-y-2 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] text-[11px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Fiscus Tap · Configuración Inicial
        </div>
        <div className="flex justify-center gap-2 pt-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                step === s ? 'w-8 bg-[#1d1d1f]' : step > s ? 'w-4 bg-[#86868b]' : 'w-4 bg-black/[0.08]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Content Area with generous whitespace */}
      <div className="py-8">
        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.025em] text-[#1d1d1f]">
                Tus datos de pago
              </h1>
              <p className="text-[#86868b] text-[15px] leading-relaxed">
                Solo lo haces una vez. Fiscus guardará tu perfil cifrado en este teléfono para que todos tus pagos sean con un toque.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#86868b] mb-2 tracking-[-0.01em]">
                  Nombre y Apellido
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Derek Gómez"
                  className="w-full px-4 py-3.5 bg-white border border-black/[0.08] rounded-2xl text-[16px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#1d1d1f] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#86868b] mb-2 tracking-[-0.01em]">
                  Documento de Identidad (Cédula)
                </label>
                <div className="flex gap-2">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as 'V' | 'E' | 'J' | 'P')}
                    className="w-20 px-3 py-3.5 bg-white border border-black/[0.08] rounded-2xl text-[16px] text-[#1d1d1f] focus:outline-none focus:border-[#1d1d1f] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="P">P</option>
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    className="flex-1 px-4 py-3.5 bg-white border border-black/[0.08] rounded-2xl text-[16px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#1d1d1f] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#86868b] mb-2 tracking-[-0.01em]">
                  Número de Teléfono (Pago Móvil)
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0412-1234567"
                  className="w-full px-4 py-3.5 bg-white border border-black/[0.08] rounded-2xl text-[16px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#1d1d1f] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: DEFAULT BANK */}
        {step === 2 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.025em] text-[#1d1d1f]">
                Tu banco principal
              </h1>
              <p className="text-[#86868b] text-[15px] leading-relaxed">
                Selecciona la entidad que usarás para pagos rápidos C2P y donde recibirás los retiros de tu saldo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {banks.map((bank) => {
                const isSelected = selectedBank === bank.code;
                return (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => setSelectedBank(bank.code)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#1d1d1f] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] scale-[1.01]'
                        : 'border-black/[0.06] bg-white hover:bg-black/[0.01]'
                    }`}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight shrink-0 shadow-sm"
                      style={{ backgroundColor: bank.color, color: bank.text_color }}
                    >
                      {bank.short_name.substring(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[#1d1d1f] text-[15px] tracking-[-0.01em]">
                        {bank.name}
                      </div>
                      <div className="text-[12px] text-[#86868b] mt-0.5">
                        Pago Móvil C2P disponible
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border border-black/[0.2] flex items-center justify-center">
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#1d1d1f]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: SECURITY PIN */}
        {step === 3 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.025em] text-[#1d1d1f]">
                PIN de confirmación
              </h1>
              <p className="text-[#86868b] text-[15px] leading-relaxed">
                Crea un PIN de 4 dígitos para autorizar pagos y retiros con máxima rapidez.
              </p>
            </div>

            <div className="flex justify-center gap-4 py-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-16 rounded-2xl border flex items-center justify-center text-2xl font-mono font-bold transition-all ${
                    pin.length === i
                      ? 'border-[#1d1d1f] bg-white shadow-sm'
                      : pin.length > i
                      ? 'border-black/[0.1] bg-[#f5f5f7] text-[#1d1d1f]'
                      : 'border-black/[0.06] bg-white text-transparent'
                  }`}
                >
                  {pin.length > i ? '•' : ''}
                </div>
              ))}
            </div>

            {/* Apple style numeric keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    if (pin.length < 4) setPin((prev) => prev + digit);
                  }}
                  className="h-14 rounded-2xl bg-white border border-black/[0.05] text-xl font-medium text-[#1d1d1f] active:bg-black/[0.05] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => {
                  if (pin.length < 4) setPin((prev) => prev + '0');
                }}
                className="h-14 rounded-2xl bg-white border border-black/[0.05] text-xl font-medium text-[#1d1d1f] active:bg-black/[0.05] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPin((prev) => prev.slice(0, -1))}
                className="h-14 rounded-2xl bg-white border border-black/[0.05] text-sm font-medium text-[#86868b] active:bg-black/[0.05] transition-all flex items-center justify-center"
              >
                Borrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Button */}
      <div className="pt-6 space-y-3">
        {step < 3 ? (
          <button
            type="button"
            disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            className="w-full py-4 rounded-2xl font-medium text-[16px] tracking-[-0.01em] bg-[#1d1d1f] text-white hover:bg-[#000000] active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            disabled={!isStep3Valid || isSaving}
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl font-medium text-[16px] tracking-[-0.01em] bg-[#1d1d1f] text-white hover:bg-[#000000] active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Guardar y entrar a la billetera'
            )}
          </button>
        )}

        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            className="w-full py-2.5 text-center text-[14px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            Volver al paso anterior
          </button>
        )}
      </div>
    </div>
  );
}
