'use client';

import { useState } from 'react';

interface AmountInputProps {
  currency?: string;
  onConfirm: (amount: number) => void;
}

export function AmountInput({ onConfirm }: AmountInputProps) {
  const [value, setValue] = useState('');

  const numericValue = parseFloat(value) || 0;
  const isValid = numericValue > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) {
      onConfirm(numericValue);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.015em]">
          Ingresa el monto a pagar
        </h2>
        <p className="text-[13px] text-[#86868b]">
          Indica la cantidad exacta solicitada por el comercio
        </p>
      </div>

      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#86868b] font-medium">
          Bs.
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          className="w-full pl-16 pr-5 py-5 bg-white border border-black/[0.08] rounded-3xl text-3xl text-[#1d1d1f] text-right font-mono focus:outline-none focus:border-[#1d1d1f] transition-all shadow-apple-sm font-semibold"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="w-full py-4 rounded-2xl font-semibold text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-apple-card"
      >
        Continuar al pago
      </button>
    </form>
  );
}
