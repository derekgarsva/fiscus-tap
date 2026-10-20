'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { getEnabledBanks } from '@/config/banks';
import { tactileSpring } from '@/lib/motion-config';

interface BankSelectorProps {
  onSelect: (bankCode: string) => void;
  savedBanks?: string[];
  selectedBank?: string;
}

export function BankSelector({
  onSelect,
  savedBanks = [],
  selectedBank,
}: BankSelectorProps) {
  const banks = getEnabledBanks();

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.015em]">
          ¿Con qué banco deseas pagar?
        </h2>
        <p className="text-[13px] text-[#86868b]">
          El autofill cargará automáticamente tus datos vinculados
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {banks.map((bank) => {
          const isCurrent = selectedBank === bank.code;
          const hasSaved = savedBanks.includes(bank.code);

          return (
            <motion.button
              whileTap={{ scale: 0.98 }}
              transition={tactileSpring}
              key={bank.code}
              type="button"
              onClick={() => onSelect(bank.code)}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                isCurrent
                  ? 'border-[#1d1d1f] bg-white shadow-apple-card scale-[1.01]'
                  : 'border-black/[0.06] bg-white hover:bg-black/[0.02] shadow-sm'
              }`}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold tracking-tight shrink-0 shadow-sm"
                style={{
                  backgroundColor: bank.color,
                  color: bank.text_color,
                }}
              >
                {bank.short_name.substring(0, 2)}
              </div>

              <div className="flex-1">
                <div className="font-semibold text-[#1d1d1f] text-[15px] tracking-[-0.01em]">
                  {bank.name}
                </div>
                {hasSaved && (
                  <div className="text-[12px] text-[#34c759] font-medium flex items-center gap-1 mt-0.5">
                    <span>✓</span> Perfil listo para autofill
                  </div>
                )}
              </div>

              <svg
                className="w-4 h-4 text-[#aeaeb2]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
