'use client';

import { useState } from 'react';
import { addFunds } from '@/lib/wallet-store';
import { UserProfile } from '@/types';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSuccess: (newBalance: number) => void;
}

export function DepositModal({ isOpen, onClose, user, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState('250');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const quickAmounts = ['100', '250', '500', '1000'];

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const numeric = parseFloat(amount);
    if (!numeric || numeric <= 0) return;

    setIsProcessing(true);
    // Simulate instantaneous bank connection
    await new Promise((r) => setTimeout(r, 1200));

    const ref = `DEP-${Date.now().toString(36).toUpperCase()}`;
    const { balance } = addFunds(numeric, user.default_bank, ref);

    setIsProcessing(false);
    onSuccess(balance);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/30 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6 shadow-apple-elevated border border-black/[0.04]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
              Ingresar Fondos
            </h2>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              Recarga tu saldo Fiscus vía Pago Móvil C2P
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/[0.05] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleDeposit} className="space-y-6">
          {/* Quick presets */}
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={`py-2 rounded-xl text-[14px] font-medium transition-all ${
                  amount === q
                    ? 'bg-[#1d1d1f] text-white shadow-sm'
                    : 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-black/[0.06]'
                }`}
              >
                Bs. {q}
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[13px] font-medium text-[#86868b] mb-2 tracking-[-0.01em]">
              Monto a ingresar (Bs.)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#86868b] font-medium">
                Bs.
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-14 pr-4 py-3.5 bg-white border border-black/[0.08] rounded-2xl text-2xl font-semibold text-[#1d1d1f] focus:outline-none focus:border-[#1d1d1f] transition-all font-mono"
                autoFocus
              />
            </div>
          </div>

          {/* Bank destination card */}
          <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-black/[0.04] flex items-center justify-between text-[13px]">
            <span className="text-[#86868b]">Banco de origen</span>
            <span className="font-semibold text-[#1d1d1f] uppercase tracking-[-0.01em]">
              {user.default_bank} ({user.phone})
            </span>
          </div>

          {/* Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isProcessing || !parseFloat(amount)}
              className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando recarga...</span>
                </>
              ) : (
                `Ingresar Bs. ${parseFloat(amount || '0').toFixed(2)}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
