'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { tactileSpring } from '@/lib/motion-config';
import {
  getUserProfile,
  getWalletBalance,
  getTransactions,
  resetWallet,
} from '@/lib/wallet-store';
import { UserProfile, WalletTransaction } from '@/types';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { BankCardsModal } from '@/components/BankCardsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { TransactionDetailModal } from '@/components/TransactionDetailModal';
import { getBankByCode } from '@/config/banks';

export default function HomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Modals
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

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

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1d1d1f] border-t-transparent rounded-full animate-spin" />
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
    <main className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col justify-between py-10 px-6 max-w-lg mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#1d1d1f] flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-sm">
            F
          </div>
          <span className="font-semibold text-[17px] tracking-[-0.022em]">
            Fiscus Tap
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            title="Reiniciar billetera para probar onboarding"
            className="text-[12px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            Reiniciar
          </button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={tactileSpring}
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Ajustes, Perfil y Soporte"
            className="w-9 h-9 rounded-full bg-black/[0.05] border border-black/[0.06] flex items-center justify-center text-sm font-semibold text-[#1d1d1f] hover:bg-black/[0.1] transition-all cursor-pointer"
          >
            {profile.name.charAt(0).toUpperCase()}
          </motion.button>
        </div>
      </header>

      {/* Main Wallet Content */}
      <div className="space-y-8 py-2">
        {/* Apple Card Component (Tap to manage bank cards) */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          transition={tactileSpring}
          onClick={() => setCardsOpen(true)}
          role="button"
          tabIndex={0}
          className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] p-7 shadow-apple-card space-y-6 cursor-pointer hover:border-[#0071e3]/40 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[12px] font-medium tracking-[0.08em] text-[#86868b] uppercase flex items-center gap-1.5">
                <span>Saldo Disponible</span>
                <span className="text-[10px] text-[#0071e3] font-semibold bg-[#0071e3]/10 px-2 py-0.5 rounded-full">
                  Cambiar Banco ▾
                </span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-medium text-[#86868b]">Bs.</span>
                <span className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
                  {balance.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[13px] text-[#86868b]">
                ≈ ${usdEstimate} USD
              </span>
            </div>

            {/* Linked Bank Badge */}
            <div className="text-right space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5f5f7] border border-black/[0.04] text-[12px] font-medium text-[#1d1d1f] group-hover:bg-[#0071e3]/10 group-hover:text-[#0071e3] transition-colors">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: defaultBank?.color || '#00A651' }}
                />
                {defaultBank?.short_name || 'Banesco'}
                <svg className="w-3.5 h-3.5 text-[#86868b] group-hover:text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              <div className="text-[11px] text-[#86868b] font-mono">
                {profile.phone}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-[12px] border-t border-black/[0.04] text-[#86868b]">
            <span className="font-medium text-[#1d1d1f]">{profile.name}</span>
            <span className="text-[#0071e3] font-medium group-hover:underline flex items-center gap-1">
              Ver tarjetas bancarias ›
            </span>
          </div>
        </motion.div>

        {/* Hero Actions: COBRAR and PAGAR with generous negative space */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div whileTap={{ scale: 0.96 }} transition={tactileSpring} className="h-full">
            <Link
              href="/cobrar"
              className="group flex flex-col justify-between p-6 rounded-3xl bg-[#1d1d1f] text-white hover:bg-black transition-all shadow-apple-card min-h-[160px] h-full"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-lg tracking-[-0.022em]">
                  Cobrar
                </div>
                <div className="text-[13px] text-white/60">
                  Modo Terminal POS
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div whileTap={{ scale: 0.96 }} transition={tactileSpring} className="h-full">
            <Link
              href="/pagar"
              className="group flex flex-col justify-between p-6 rounded-3xl bg-white border border-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.02] transition-all shadow-apple-card min-h-[160px] h-full"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                <svg
                  className="w-6 h-6 text-[#0071e3]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-lg tracking-[-0.022em]">
                  Pagar
                </div>
                <div className="text-[13px] text-[#86868b]">
                  Radar & Escáner
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Quick Action Pills: Ingresar / Retirar */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={tactileSpring}
            type="button"
            onClick={() => setDepositOpen(true)}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-white border border-black/[0.06] text-[14px] font-medium text-[#1d1d1f] hover:bg-black/[0.02] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span className="text-[#34c759] font-bold text-lg">+</span>
            <span>Ingresar Fondos</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={tactileSpring}
            type="button"
            onClick={() => setWithdrawOpen(true)}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-white border border-black/[0.06] text-[14px] font-medium text-[#1d1d1f] hover:bg-black/[0.02] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span className="text-[#0071e3] font-bold text-lg">↑</span>
            <span>Retirar a mi Banco</span>
          </motion.button>
        </div>

        {/* Recent Transactions Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-[#1d1d1f]">
              Actividad Reciente
            </h2>
            <span className="text-[12px] text-[#86868b]">Últimos movimientos</span>
          </div>

          <div className="space-y-2.5">
            {transactions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-black/[0.04] text-[#86868b] text-[14px]">
                No hay movimientos registrados aún.
              </div>
            ) : (
              transactions.slice(0, 5).map((tx) => {
                const isPositive = tx.type === 'deposit' || tx.type === 'payment_received';
                return (
                  <motion.div
                    key={tx.id}
                    whileTap={{ scale: 0.98 }}
                    transition={tactileSpring}
                    onClick={() => setSelectedTx(tx)}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/[0.04] shadow-apple-sm hover:border-[#0071e3]/30 hover:shadow-apple-card transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${
                          isPositive
                            ? 'bg-[#34c759]/10 text-[#34c759]'
                            : 'bg-black/[0.04] text-[#1d1d1f]'
                        }`}
                      >
                        {isPositive ? '↓' : '↑'}
                      </div>
                      <div>
                        <div className="font-medium text-[15px] tracking-[-0.01em] text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">
                          {tx.title}
                        </div>
                        <div className="text-[12px] text-[#86868b]">
                          {tx.subtitle || new Date(tx.timestamp).toLocaleDateString('es-VE')}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-semibold font-mono text-[15px] ${
                          isPositive ? 'text-[#34c759]' : 'text-[#1d1d1f]'
                        }`}
                      >
                        {isPositive ? '+' : '-'} Bs. {tx.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-[#86868b] font-mono">
                        {tx.reference.substring(0, 10)}...
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer Branding & APK Portal */}
      <footer className="text-center pt-8 pb-2 space-y-2">
        <div>
          <Link
            href="/apkportal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-3 py-1.5 rounded-full transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar APK Oficial para Android
          </Link>
        </div>
        <span className="text-[11px] text-[#aeaeb2] tracking-[0.08em] uppercase block">
          Fiscus Tap · Pagos Físicos a un Toque
        </span>
      </footer>

      {/* Modals */}
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

      {/* Bank Cards Modal */}
      <BankCardsModal
        isOpen={cardsOpen}
        onClose={() => setCardsOpen(false)}
        currentUser={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          loadWalletData();
        }}
      />

      {/* Settings & Support Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          loadWalletData();
        }}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
      />
    </main>
  );
}
