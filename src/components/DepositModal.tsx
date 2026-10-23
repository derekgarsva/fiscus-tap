'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addFunds } from '@/lib/wallet-store';
import { UserProfile } from '@/types';
import {
  modalBackdropVariants,
  bottomSheetVariants,
  bottomSheetDragProps,
  createDragEndHandler,
} from '@/lib/motion-config';
import { MoneyInput } from '@/components/ui/money-input';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSuccess: (newBalance: number) => void;
}

export function DepositModal({ isOpen, onClose, user, onSuccess }: DepositModalProps) {
  const [amountMinor, setAmountMinor] = useState<number | null>(25000); // 250.00 default
  const [selectedCurrency, setSelectedCurrency] = useState('VES');
  const [isProcessing, setIsProcessing] = useState(false);

  const numericAmount = amountMinor !== null ? amountMinor / 100 : 0;

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!numericAmount || numericAmount <= 0) return;

    setIsProcessing(true);
    // Simulate instantaneous bank connection
    await new Promise((r) => setTimeout(r, 1000));

    const ref = `DEP-${Date.now().toString(36).toUpperCase()}`;
    const { balance } = addFunds(numericAmount, user.default_bank, ref);

    setIsProcessing(false);
    onSuccess(balance);
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="deposit-backdrop"
          variants={modalBackdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            key="deposit-sheet"
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
                    Ingresar Fondos
                  </h2>
                  <p className="text-[13px] text-neutral-500 mt-0.5">
                    Recarga tu saldo con el componente oficial MoneyInput
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

              <form onSubmit={handleDeposit} className="space-y-6">
                {/* Official UIARC MoneyInput Component */}
                <div>
                  <MoneyInput
                    label="Monto a Ingresar"
                    value={amountMinor}
                    onValueChange={(val) => setAmountMinor(val)}
                    currency={selectedCurrency}
                    onCurrencyChange={setSelectedCurrency}
                    currencies={['VES', 'USD', 'EUR', 'SGD', 'GBP']}
                    quickAdd={[50, 100, 250, 500]}
                    min={100} // Min 1.00
                  />
                </div>

                {/* Bank destination card */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-black/5 flex items-center justify-between text-[13px] font-mono">
                  <span className="text-neutral-500 uppercase">Banco Origen</span>
                  <span className="font-bold text-black uppercase">
                    {user.default_bank} ({user.phone})
                  </span>
                </div>

                {/* Action */}
                <div className="pt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    disabled={isProcessing || numericAmount <= 0}
                    className="w-full py-4 rounded-2xl font-bold text-[15px] font-mono uppercase tracking-wider bg-black text-white hover:bg-neutral-800 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Procesando recarga...</span>
                      </>
                    ) : (
                      `Confirmar Ingreso de ${selectedCurrency} ${numericAmount.toFixed(2)}`
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
