'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WalletTransaction } from '@/types';

interface TodayReceiptProps {
  transactions: WalletTransaction[];
  currencySymbol?: string;
  onSelectTx?: (tx: WalletTransaction) => void;
  onOpenQuickRecord?: () => void;
}

export function TodayReceipt({
  transactions,
  currencySymbol = "$",
  onSelectTx,
  onOpenQuickRecord,
}: TodayReceiptProps) {
  const [copied, setCopied] = useState(false);

  // Filter today's transactions
  const now = new Date();
  const todayDateStr = now.toDateString();

  const todayTxs = transactions.filter((tx) => {
    const txDate = new Date(tx.timestamp);
    return txDate.toDateString() === todayDateStr && tx.type === 'payment_sent';
  });

  const totalExpense = todayTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const itemCount = todayTxs.length;
  const avgExpense = itemCount > 0 ? totalExpense / itemCount : 0;

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();

  const receiptId = `RCPT-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.abs(Math.round(totalExpense * 10)).toString(36).toUpperCase()}`;

  function handleCopyReceipt() {
    let text = `====================================\n`;
    text += `          TODAY'S RECEIPT           \n`;
    text += `       ${formattedDate}       \n`;
    text += `====================================\n\n`;

    todayTxs.forEach((tx) => {
      const time = new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      text += `${tx.title.padEnd(20, '.')} ${currencySymbol} ${tx.amount.toFixed(2)} [${time}]\n`;
    });

    text += `\n------------------------------------\n`;
    text += `TOTAL: ${currencySymbol} ${totalExpense.toFixed(2)}\n`;
    text += `ITEMS: ${itemCount}\n`;
    text += `REF: ${receiptId}\n`;
    text += `====================================\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="w-full relative font-mono text-black select-none">
      {/* Thermal receipt jagged top edge */}
      <div className="w-full h-3 overflow-hidden flex items-end">
        <svg
          className="w-full h-3 text-[#fbfbfb]"
          preserveAspectRatio="none"
          viewBox="0 0 100 10"
          fill="currentColor"
        >
          <polygon points="0,10 5,0 10,10 15,0 20,10 25,0 30,10 35,0 40,10 45,0 50,10 55,0 60,10 65,0 70,10 75,0 80,10 85,0 90,10 95,0 100,10" />
        </svg>
      </div>

      {/* Main Thermal Paper Body */}
      <div className="bg-[#fbfbfb] border-x border-black/10 px-5 sm:px-7 py-6 shadow-[0_12px_32px_rgba(0,0,0,0.06)] relative overflow-hidden">
        {/* Paper texture overlay subtle grain */}
        <div className="absolute inset-0 bg-[radial-gradient(#000000_0.75px,transparent_0.75px)] [background-size:16px_16px] opacity-[0.03] pointer-events-none" />

        {/* Receipt Header */}
        <div className="text-center space-y-1 mb-5 relative z-10">
          <div className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
            *** OFFICIAL RECORD ***
          </div>
          <h2 className="text-lg font-black tracking-[-0.03em] uppercase">
            Today&apos;s Receipt
          </h2>
          <div className="text-[11px] text-neutral-600 font-medium tracking-tight">
            {formattedDate}
          </div>
          <div className="text-[10px] text-neutral-400">
            ID: {receiptId}
          </div>
        </div>

        {/* Separator Dashed */}
        <div className="border-t border-dashed border-black/25 my-4" />

        {/* Itemized Table Header */}
        <div className="flex justify-between text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
          <span>Item &amp; Category</span>
          <span>Amount</span>
        </div>

        {/* Items List */}
        <div className="space-y-3 relative z-10">
          {todayTxs.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <div className="text-2xl opacity-40">🧾</div>
              <p className="text-[12px] text-neutral-500 max-w-[240px] mx-auto leading-relaxed">
                No hay gastos registrados hoy. Desliza hacia arriba para agregar tu primer gasto.
              </p>
              {onOpenQuickRecord && (
                <button
                  type="button"
                  onClick={onOpenQuickRecord}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-[11px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  <span>+ Registrar Ahora</span>
                </button>
              )}
            </div>
          ) : (
            todayTxs.map((tx) => {
              const time = new Date(tx.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const category = tx.subtitle?.split('·')[0]?.trim() || 'General';

              return (
                <motion.div
                  key={tx.id}
                  whileHover={{ x: 2 }}
                  onClick={() => onSelectTx?.(tx)}
                  role="button"
                  tabIndex={0}
                  className="flex items-start justify-between gap-3 text-[13px] leading-tight cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-bold text-black group-hover:underline truncate max-w-[170px] sm:max-w-[220px]">
                        {tx.title}
                      </span>
                      <span className="text-[10px] text-neutral-500 bg-black/5 px-1.5 py-0.5 rounded font-sans uppercase tracking-wider">
                        {category}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      {time} · Ref: {tx.reference.slice(-6)}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 font-bold text-black text-[14px] tabular-nums">
                    {currencySymbol} {tx.amount.toFixed(2)}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Dashed Separator */}
        <div className="border-t border-dashed border-black/25 my-4" />

        {/* Calculations / Summary */}
        <div className="space-y-1.5 text-[12px] text-neutral-600 relative z-10">
          <div className="flex justify-between">
            <span>Items Recorded:</span>
            <span className="font-bold text-black">{itemCount}</span>
          </div>
          {itemCount > 0 && (
            <div className="flex justify-between">
              <span>Average / Item:</span>
              <span className="font-bold text-black">
                {currencySymbol} {avgExpense.toFixed(2)}
              </span>
            </div>
          )}

          {/* Double line for Grand Total */}
          <div className="border-t-2 border-black/80 pt-2 mt-2 flex justify-between items-baseline">
            <span className="font-black text-sm uppercase tracking-wide text-black">
              Total Today
            </span>
            <span className="font-black text-2xl tracking-tight text-black tabular-nums">
              {currencySymbol} {totalExpense.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Analog Thermal Barcode & Verification */}
        <div className="mt-7 pt-4 border-t border-dashed border-black/20 text-center space-y-2 relative z-10">
          {/* Pseudo-Barcode lines */}
          <div className="h-8 flex items-stretch justify-center gap-[2px] opacity-75">
            {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 1, 2, 4, 2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3].map(
              (w, i) => (
                <div
                  key={i}
                  className="bg-black"
                  style={{ width: `${w * 1.5}px` }}
                />
              )
            )}
          </div>
          <div className="text-[10px] text-neutral-400 tracking-[0.2em] uppercase">
            * FISCUS MONOCHROME LEDGER *
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="px-3 py-1 rounded border border-black/20 hover:border-black text-[11px] font-bold text-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              {copied ? '✓ Copiado' : 'Copiar Recibo'}
            </button>
          </div>
        </div>
      </div>

      {/* Thermal receipt jagged bottom edge */}
      <div className="w-full h-3 overflow-hidden flex items-start">
        <svg
          className="w-full h-3 text-[#fbfbfb]"
          preserveAspectRatio="none"
          viewBox="0 0 100 10"
          fill="currentColor"
        >
          <polygon points="0,0 5,10 10,0 15,10 20,0 25,10 30,0 35,10 40,0 45,10 50,0 55,10 60,0 65,10 70,0 75,10 80,0 85,10 90,0 95,10 100,0" />
        </svg>
      </div>
    </div>
  );
}
