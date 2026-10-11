'use client';

import { useState } from 'react';
import { withdrawFunds } from '@/lib/wallet-store';
import { UserProfile } from '@/types';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentBalance: number;
  onSuccess: (newBalance: number) => void;
}

export function WithdrawModal({
  isOpen,
  onClose,
  user,
  currentBalance,
  onSuccess,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const numeric = parseFloat(amount) || 0;

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (numeric <= 0) return;
    if (numeric > currentBalance) {
      setError('El monto supera tu saldo disponible.');
      return;
    }

    setIsProcessing(true);
    setError('');

    // Simulate instant bank payout
    await new Promise((r) => setTimeout(r, 1200));

    const result = withdrawFunds(numeric, user.default_bank);
    setIsProcessing(false);

    if (result.success) {
      onSuccess(result.balance);
      onClose();
    } else {
      setError(result.message || 'Error al procesar retiro');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/30 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-6 shadow-apple-elevated border border-black/[0.04]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
              Retirar a tu Banco
            </h2>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              Disponible: Bs. {currentBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
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

        <form onSubmit={handleWithdraw} className="space-y-6">
          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[13px] font-medium text-[#86868b] tracking-[-0.01em]">
                Monto a retirar (Bs.)
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(currentBalance))}
                className="text-[12px] font-medium text-[#0071e3] hover:underline"
              >
                Retirar todo
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#86868b] font-medium">
                Bs.
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                max={currentBalance}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                placeholder="0.00"
                className="w-full pl-14 pr-4 py-3.5 bg-white border border-black/[0.08] rounded-2xl text-2xl font-semibold text-[#1d1d1f] focus:outline-none focus:border-[#1d1d1f] transition-all font-mono"
                autoFocus
              />
            </div>
            {error && <p className="text-[12px] text-[#ff3b30] mt-1.5">{error}</p>}
          </div>

          {/* Destination info */}
          <div className="p-4 rounded-2xl bg-[#f5f5f7] border border-black/[0.04] space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#86868b]">Destino</span>
              <span className="font-semibold text-[#1d1d1f] uppercase">
                {user.default_bank}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#86868b]">Titular</span>
              <span className="text-[#1d1d1f] font-medium">
                {user.name} ({user.document_type}-{user.document_number})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#86868b]">Teléfono asociado</span>
              <span className="text-[#1d1d1f] font-mono">{user.phone}</span>
            </div>
          </div>

          {/* Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isProcessing || numeric <= 0 || numeric > currentBalance}
              className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Transfiriendo a tu banco...</span>
                </>
              ) : (
                `Transferir Bs. ${numeric.toFixed(2)}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
