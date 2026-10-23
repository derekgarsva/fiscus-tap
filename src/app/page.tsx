'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { tactileSpring } from '@/lib/motion-config';
import {
  getUserProfile,
  getWalletBalance,
  getTransactions,
  recordExpense,
  resetWallet,
} from '@/lib/wallet-store';
import { UserProfile, WalletTransaction } from '@/types';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { BankCardsModal } from '@/components/BankCardsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { TransactionDetailModal } from '@/components/TransactionDetailModal';
import { TodayReceipt } from '@/components/TodayReceipt';
import { MinimalAnalytics } from '@/components/MinimalAnalytics';
import { NaturalLanguageQuickRecord } from '@/components/NaturalLanguageQuickRecord';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { getBankByCode } from '@/config/banks';

type MainViewTab = 'receipt' | 'analytics' | 'activity';

export default function HomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<MainViewTab>('receipt');

  // Modals & Drawers
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickRecordOpen, setQuickRecordOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadWalletData();

    const handleRefresh = () => {
      loadWalletData();
    };

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('pageshow', handleRefresh);
    window.addEventListener('storage', handleRefresh);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('pageshow', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  function loadWalletData() {
    const p = getUserProfile();
    setProfile(p);
    setBalance(getWalletBalance());
    setTransactions(getTransactions());
    setIsLoaded(true);
  }

  function handleOnboardingComplete(newProfile: UserProfile) {
    setProfile(newProfile);
    setBalance(getWalletBalance());
    setTransactions(getTransactions());
  }

  function handleReset() {
    if (confirm('¿Deseas reiniciar la billetera para volver a probar el onboarding inicial?')) {
      resetWallet();
      setProfile(null);
      setBalance(0);
      setTransactions([]);
    }
  }

  function handleQuickExpenseRecord(expense: {
    amount: number;
    description: string;
    category: string;
    currency: string;
  }) {
    const { balance: newBal } = recordExpense(
      expense.amount,
      expense.description,
      expense.category,
      expense.currency
    );
    setBalance(newBal);
    setTransactions(getTransactions());

    // Show feedback toast
    setToastMessage(`✓ ${expense.currency} ${expense.amount.toFixed(2)} registrado en Today's Receipt`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }

  if (!isLoaded) {
    return (
      <main className="min-h-[100dvh] w-full max-w-lg mx-auto bg-black text-white flex flex-col justify-between py-6 px-5 pt-safe pb-safe overflow-x-hidden">
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <Skeleton lines={1} className="w-32 h-6 bg-white/10" />
            <Skeleton avatar lines={0} className="bg-white/10" />
          </div>
          <div className="rounded-3xl bg-neutral-900 border border-white/10 p-7 space-y-4">
            <Skeleton lines={3} className="bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-neutral-900 p-6 h-36 border border-white/10">
              <Skeleton lines={2} className="bg-white/10" />
            </div>
            <div className="rounded-3xl bg-neutral-900 p-6 h-36 border border-white/10">
              <Skeleton lines={2} className="bg-white/10" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton lines={4} className="bg-white/10" />
          </div>
        </div>
      </main>
    );
  }

  // If not onboarded -> Render Apple Onboarding Flow
  if (!profile || !profile.is_onboarded) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  const defaultBank = getBankByCode(profile.default_bank);
  const usdEstimate = (balance / 50).toFixed(2); // Approximate ref

  return (
    <main className="min-h-[100dvh] w-full max-w-lg mx-auto bg-neutral-950 text-white flex flex-col justify-between pt-5 pb-32 px-4 sm:px-6 pt-safe overflow-x-hidden selection:bg-white selection:text-black">
      {/* Top Header - Radical Monochromatic */}
      <header className="flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-black text-sm tracking-tight shadow-md">
            F
          </div>
          <div>
            <span className="font-bold text-[17px] tracking-[-0.03em] block leading-tight">
              Fiscus Tap
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
              Radical Minimalism
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu
            label={profile.name.split(' ')[0]}
            items={[
              {
                label: 'Nuevo Gasto (Just Type)',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                ),
                onSelect: () => setQuickRecordOpen(true),
              },
              {
                label: 'Gestionar Tarjetas',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                ),
                onSelect: () => setCardsOpen(true),
              },
              {
                label: 'Ajustes y Perfil',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                onSelect: () => setSettingsOpen(true),
              },
              {
                label: 'Descargar APK (Android)',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                ),
                onSelect: () => window.open('https://apkportal.vercel.app/fiscus', '_blank'),
              },
              {
                label: 'Reiniciar Billetera',
                destructive: true,
                separatorBefore: true,
                onSelect: handleReset,
              },
            ]}
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={tactileSpring}
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Ajustes y Perfil"
            className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-sm font-semibold text-white hover:bg-white/20 transition-all cursor-pointer"
          >
            {profile.name.charAt(0).toUpperCase()}
          </motion.button>
        </div>
      </header>

      {/* Main Ledger Content */}
      <div className="space-y-6 py-4">
        {/* Radical Monochromatic Balance Card */}
        <motion.div
          whileTap={{ scale: 0.99 }}
          transition={tactileSpring}
          className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/10 p-7 shadow-2xl space-y-5"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono tracking-[0.14em] text-neutral-400 uppercase block">
                Total Balance · Disponible
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-mono text-neutral-400">Bs.</span>
                <span className="text-4xl font-black tracking-[-0.04em] font-mono text-white">
                  {balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[12px] text-neutral-400 font-mono">
                ≈ ${usdEstimate} USD / SGD Equiv.
              </span>
            </div>

            {/* Linked Bank Pill */}
            <div className="text-right space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 border border-white/10 text-[11px] font-mono text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {defaultBank?.short_name || 'Banesco'}
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">
                {profile.phone}
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-white/10">
            <span className="font-mono text-[12px] text-neutral-300 uppercase tracking-wider">
              {profile.name}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={tactileSpring}
              onClick={() => setCardsOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200 text-[11px] font-bold font-mono uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Tarjetas</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Hero Actions: COBRAR and PAGAR in Pure Radical Monochromatic */}
        <div className="grid grid-cols-2 gap-3.5">
          <motion.div whileTap={{ scale: 0.97 }} transition={tactileSpring} className="h-full">
            <Link
              href="/cobrar"
              className="group flex flex-col justify-between p-5 rounded-2xl bg-white text-black hover:bg-neutral-100 transition-all shadow-lg min-h-[140px] h-full"
            >
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-base tracking-tight font-mono uppercase">
                  Cobrar
                </div>
                <div className="text-[11px] text-neutral-600 font-mono">
                  Terminal POS
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div whileTap={{ scale: 0.97 }} transition={tactileSpring} className="h-full">
            <Link
              href="/pagar"
              className="group flex flex-col justify-between p-5 rounded-2xl bg-neutral-900 border border-white/15 text-white hover:bg-neutral-800 transition-all shadow-lg min-h-[140px] h-full"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-base tracking-tight font-mono uppercase">
                  Pagar
                </div>
                <div className="text-[11px] text-neutral-400 font-mono">
                  Radar NFC
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Quick Action Pills: Ingresar / Retirar (Using UIARC MoneyInput) */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={tactileSpring}
            type="button"
            onClick={() => setDepositOpen(true)}
            className="py-3 px-3.5 rounded-xl bg-neutral-900 border border-white/15 text-[12px] font-mono font-bold uppercase tracking-wider text-white hover:bg-neutral-800 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="font-bold text-base">+</span>
            <span>Ingresar Fondos</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={tactileSpring}
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="py-3 px-3.5 rounded-xl bg-neutral-900 border border-white/15 text-[12px] font-mono font-bold uppercase tracking-wider text-white hover:bg-neutral-800 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="font-bold text-base">↑</span>
            <span>Retirar a Banco</span>
          </motion.button>
        </div>

        {/* Segmented Control: Recibo de Hoy / Analítica Mínima / Actividad */}
        <div className="pt-2">
          <div className="flex p-1 rounded-2xl bg-neutral-900 border border-white/10 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('receipt')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-center font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'receipt'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Today&apos;s Receipt
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-center font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Analítica
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-center font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Actividad
            </button>
          </div>
        </div>

        {/* View Tab Contents */}
        <div className="pt-1">
          {activeTab === 'receipt' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TodayReceipt
                transactions={transactions}
                currencySymbol="SGD"
                onSelectTx={setSelectedTx}
                onOpenQuickRecord={() => setQuickRecordOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MinimalAnalytics
                transactions={transactions}
                currencySymbol="SGD"
              />
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-mono uppercase tracking-wider text-neutral-400">
                  Historial de Transacciones
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  {transactions.length} registros
                </span>
              </div>

              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-900 rounded-2xl border border-white/10 text-neutral-400 text-[13px] font-mono">
                    No hay movimientos registrados aún.
                  </div>
                ) : (
                  transactions.map((tx) => {
                    const isPositive = tx.type === 'deposit' || tx.type === 'payment_received';
                    return (
                      <motion.div
                        key={tx.id}
                        whileTap={{ scale: 0.98 }}
                        transition={tactileSpring}
                        onClick={() => setSelectedTx(tx)}
                        role="button"
                        tabIndex={0}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-900 border border-white/10 hover:border-white/25 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm font-mono ${
                              isPositive
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white'
                            }`}
                          >
                            {isPositive ? '↓' : '↑'}
                          </div>
                          <div>
                            <div className="font-semibold text-[14px] text-white group-hover:text-neutral-200 transition-colors">
                              {tx.title}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {tx.subtitle || new Date(tx.timestamp).toLocaleDateString('es-VE')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-bold font-mono text-[14px] ${
                              isPositive ? 'text-white' : 'text-neutral-300'
                            }`}
                          >
                            {isPositive ? '+' : '-'} {tx.currency || 'Bs.'} {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {tx.reference.substring(0, 10)}...
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Floating Monochromatic Swipe Up / Tap Bar */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        onDragEnd={(_, info) => {
          if (info.offset.y < -30 || info.velocity.y < -150) {
            setQuickRecordOpen(true);
          }
        }}
        onClick={() => setQuickRecordOpen(true)}
        className="fixed bottom-5 left-4 right-4 max-w-lg mx-auto z-40 cursor-grab active:cursor-grabbing"
      >
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="relative overflow-hidden bg-white text-black rounded-2xl p-4 shadow-2xl border border-black/10 flex items-center justify-between"
        >
          {/* Subtle animated swipe indicator */}
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm"
            >
              ↑
            </motion.div>
            <div>
              <div className="text-[13px] font-bold font-mono uppercase tracking-tight flex items-center gap-2">
                <span>Desliza hacia arriba para registrar</span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono">
                Just Type: &quot;6 coffee&quot; · Release to record
              </div>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-black text-white font-mono text-[10px] font-black uppercase tracking-wider">
            NLP
          </div>
        </motion.div>
      </motion.div>

      {/* Monochromatic Feedback Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed top-5 left-4 right-4 max-w-sm mx-auto z-50 bg-white text-black font-mono text-[12px] font-bold px-4 py-3 rounded-xl shadow-2xl border border-black/15 text-center"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <NaturalLanguageQuickRecord
        isOpen={quickRecordOpen}
        onOpenChange={setQuickRecordOpen}
        onRecord={handleQuickExpenseRecord}
        currencyCode="SGD"
      />

      <DepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        user={profile}
        onSuccess={(newBal) => {
          setBalance(newBal);
          setTransactions(getTransactions());
        }}
      />

      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        user={profile}
        currentBalance={balance}
        onSuccess={(newBal) => {
          setBalance(newBal);
          setTransactions(getTransactions());
        }}
      />

      <BankCardsModal
        isOpen={cardsOpen}
        onClose={() => setCardsOpen(false)}
        currentUser={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          loadWalletData();
        }}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          loadWalletData();
        }}
      />

      <TransactionDetailModal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
      />
    </main>
  );
}
