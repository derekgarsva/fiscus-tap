'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { withdrawFunds } from '@/lib/wallet-store';
import { UserProfile } from '@/types';
import {
  modalBackdropVariants,
  bottomSheetVariants,
  bottomSheetDragProps,
  createDragEndHandler,
} from '@/lib/motion-config';
import { MoneyInput } from '@/components/ui/money-input';

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
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('VES');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const numericAmount = amountMinor !== null ? amountMinor / 100 : 0;
  const maxMinor = Math.round(currentBalance * 100);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (numericAmount <= 0) return;
    if (numericAmount > currentBalance) {
      setError('El monto supera tu saldo disponible.');
      return;
    }

    setIsProcessing(true);
    setError('');

    // Simulate instant bank payout
    await new Promise((r) => setTimeout(r, 1000));

    const result = withdrawFunds(numericAmount, user.default_bank);
    setIsProcessing(false);

    if (result.success) {
      onSuccess(result.balance);
      onClose();
    } else {
      setError(result.message || 'Error al procesar retiro');
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="withdraw-backdrop"
          variants={modalBackdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="withdraw-sheet"
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            {...bottomSheetDragProps}
            onDragEnd={createDragEndHandler(onClose)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-black/10 max-h-[90vh] flex flex-col overflow-hidden pb-safe text-black font-sans"
          >
            {/* Top Drag Handle */}
            <div className="w-full pt-3 pb-1 flex justify-center touch-none cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-black/20" />
            </div>

            {/* Scrollable Container */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-black font-mono uppercase">
                    Retirar Fondos
                  </h2>
                  <p className="text-[13px] text-neutral-500 mt-0.5 font-mono">
                    Disponible: Bs.{' '}
                    {currentBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-neutral-100 text-black hover:bg-neutral-200 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                >
                  ✕
                </motion.button>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-6">
                {/* MoneyInput with Max Limit and All-In button */}
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setAmountMinor(maxMinor)}
                      className="text-[11px] font-bold font-mono uppercase text-black hover:underline cursor-pointer"
                    >
                      [ Retirar Todo ]
                    </button>
                  </div>
                  <MoneyInput
                    label="Monto a Retirar"
                    value={amountMinor}
                    onValueChange={(val) => {
                      setAmountMinor(val);
                      setError('');
                    }}
                    currency={selectedCurrency}
                    onCurrencyChange={setSelectedCurrency}
                    currencies={['VES', 'USD', 'EUR', 'SGD', 'GBP']}
                    max={maxMinor}
                    quickAdd={[50, 100, 250, 500]}
                    error={error}
                  />
                </div>

                {/* Destination info */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-black/5 space-y-2 text-[13px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-500 uppercase">Destino</span>
                    <span className="font-bold text-black uppercase">
                      {user.default_bank}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 uppercase">Titular</span>
                    <span className="text-black font-medium">
                      {user.name} ({user.document_type}-{user.document_number})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 uppercase">Teléfono</span>
                    <span className="text-black font-bold">{user.phone}</span>
                  </div>
                </div>

                {/* Action */}
                <div className="pt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    disabled={isProcessing || numericAmount <= 0 || numericAmount > currentBalance}
                    className="w-full py-4 rounded-2xl font-bold text-[15px] font-mono uppercase tracking-wider bg-black text-white hover:bg-neutral-800 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Transfiriendo a tu banco...</span>
                      </>
                    ) : (
                      `Transferir ${selectedCurrency} ${numericAmount.toFixed(2)}`
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
