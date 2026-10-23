'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { WalletTransaction } from '@/types';

type TimeRange = 'today' | 'month' | 'year';

interface MinimalAnalyticsProps {
  transactions: WalletTransaction[];
  currencySymbol?: string;
}

export function MinimalAnalytics({
  transactions,
  currencySymbol = '$',
}: MinimalAnalyticsProps) {
  const [range, setRange] = useState<TimeRange>('today');

  const now = new Date();

  // Filter transactions by range
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.type !== 'payment_sent') return false;
      const d = new Date(tx.timestamp);
      if (range === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (range === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (range === 'year') {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [transactions, range, now]);

  const totalSpent = useMemo(() => {
    return filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTxs]);

  const highestExpense = useMemo(() => {
    if (filteredTxs.length === 0) return 0;
    return Math.max(...filteredTxs.map((t) => t.amount));
  }, [filteredTxs]);

  // Aggregate by Category
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTxs.forEach((tx) => {
      const cat = tx.subtitle?.split('·')[0]?.trim() || 'General';
      map[cat] = (map[cat] || 0) + tx.amount;
    });

    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxs, totalSpent]);

  // Generate bar chart data
  const chartData = useMemo(() => {
    if (range === 'today') {
      // 4 time blocks: Morning (6-12), Afternoon (12-18), Evening (18-24), Night (0-6)
      const blocks = [
        { label: '00-06h', amount: 0 },
        { label: '06-12h', amount: 0 },
        { label: '12-18h', amount: 0 },
        { label: '18-24h', amount: 0 },
      ];
      filteredTxs.forEach((tx) => {
        const hour = new Date(tx.timestamp).getHours();
        if (hour < 6) blocks[0].amount += tx.amount;
        else if (hour < 12) blocks[1].amount += tx.amount;
        else if (hour < 18) blocks[2].amount += tx.amount;
        else blocks[3].amount += tx.amount;
      });
      return blocks;
    }

    if (range === 'month') {
      // 4 weeks
      const weeks = [
        { label: 'Sem 1', amount: 0 },
        { label: 'Sem 2', amount: 0 },
        { label: 'Sem 3', amount: 0 },
        { label: 'Sem 4', amount: 0 },
      ];
      filteredTxs.forEach((tx) => {
        const day = new Date(tx.timestamp).getDate();
        if (day <= 7) weeks[0].amount += tx.amount;
        else if (day <= 14) weeks[1].amount += tx.amount;
        else if (day <= 21) weeks[2].amount += tx.amount;
        else weeks[3].amount += tx.amount;
      });
      return weeks;
    }

    // Year: Last 6 months or 4 quarters
    const quarters = [
      { label: 'Q1', amount: 0 },
      { label: 'Q2', amount: 0 },
      { label: 'Q3', amount: 0 },
      { label: 'Q4', amount: 0 },
    ];
    filteredTxs.forEach((tx) => {
      const month = new Date(tx.timestamp).getMonth();
      const q = Math.floor(month / 3);
      quarters[q].amount += tx.amount;
    });
    return quarters;
  }, [filteredTxs, range]);

  const maxBarValue = Math.max(...chartData.map((d) => d.amount), 1);

  return (
    <div className="w-full rounded-3xl bg-white border border-black/10 p-6 shadow-sm space-y-6 text-black">
      {/* Header and Segmented Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-neutral-500 uppercase block">
            Analítica Mínima
          </span>
          <h3 className="text-xl font-bold tracking-tight">
            Patrones de Consumo
          </h3>
        </div>

        {/* Monochromatic Segmented Control */}
        <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-black/5 self-start sm:self-auto">
          {(['today', 'month', 'year'] as TimeRange[]).map((tab) => {
            const active = range === tab;
            const labels: Record<TimeRange, string> = {
              today: 'Today',
              month: 'This month',
              year: 'This year',
            };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setRange(tab)}
                className={`relative px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                  active
                    ? 'text-white bg-black shadow-sm'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Stats Contrast */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        <div className="p-4 rounded-2xl bg-neutral-50 border border-black/5">
          <span className="text-[11px] font-mono uppercase text-neutral-500 block mb-1">
            Gasto Consolidado
          </span>
          <span className="text-2xl font-black font-mono tracking-tight text-black">
            {currencySymbol} {totalSpent.toFixed(2)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-50 border border-black/5">
          <span className="text-[11px] font-mono uppercase text-neutral-500 block mb-1">
            Gasto Máximo
          </span>
          <span className="text-2xl font-black font-mono tracking-tight text-black">
            {currencySymbol} {highestExpense.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Clean Monochromatic Bar Chart */}
      <div className="space-y-3">
        <div className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
          Distribución Temporal
        </div>
        <div className="h-28 flex items-end justify-between gap-3 pt-4 border-b border-black/10 pb-2">
          {chartData.map((item, index) => {
            const heightPct = Math.max((item.amount / maxBarValue) * 100, 4);
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
              >
                <div className="text-[10px] font-mono text-neutral-400 group-hover:text-black transition-colors opacity-0 group-hover:opacity-100">
                  {currencySymbol}{item.amount.toFixed(0)}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="w-full max-w-[48px] bg-black rounded-t-md transition-opacity group-hover:bg-neutral-800"
                />
                <span className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown Bars */}
      {categoryStats.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
            Desglose por Categoría
          </div>
          <div className="space-y-2">
            {categoryStats.slice(0, 4).map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-[12px] font-mono">
                  <span className="font-semibold text-black">{cat.name}</span>
                  <span className="text-neutral-500">
                    {currencySymbol} {cat.amount.toFixed(2)} ({cat.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black rounded-full"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
