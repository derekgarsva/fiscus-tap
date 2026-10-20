'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, recordCollection } from '@/lib/wallet-store';
import { ChargeSession, UserProfile } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useHceSession, useNfcReader, FiscusNfcBridge } from '@/lib/nfc-bridge';
import { Receipt } from '@/components/Receipt';
import { motion } from 'framer-motion';
import {
  triumphantSpring,
  receiptCardVariants,
  receiptItemVariants,
  tactileSpring,
} from '@/lib/motion-config';

let sharedAudioCtx: AudioContext | null = null;

function unlockAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  } catch {}
  return sharedAudioCtx;
}

export default function CobrarPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [session, setSession] = useState<ChargeSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidDetails, setPaidDetails] = useState<{
    payer: string;
    ref: string;
    bank?: string;
    cardBrand?: string;
    maskedPan?: string;
    isCard?: boolean;
  } | null>(null);
  const [simulatingTap, setSimulatingTap] = useState(false);

  // Dedicated HCE Session Hook (for Phone-to-Phone mode)
  const { isArmed, isPayloadSent, armSession, disarmSession } = useHceSession();

  // Dedicated NFC Reader Hook (for Physical Contactless Bank Cards)
  const { isScanning, discoveredTag, startScanning, stopScanning, clearDiscoveredTag } = useNfcReader({
    timeoutMs: 30000,
  });

  function handleGoToWallet() {
    disarmSession().catch(() => {});
    stopScanning().catch(() => {});
    router.push('/');
  }

  const sessionRef = useRef<ChargeSession | null>(null);
  sessionRef.current = session;

  const isPaidRef = useRef(false);
  isPaidRef.current = isPaid;

  useEffect(() => {
    const profile = getUserProfile();
    setUser(profile);
  }, []);

  // When charge session is active, also start Reader Mode to scan for physical contactless cards
  useEffect(() => {
    if (session && !isPaid) {
      startScanning().catch((err) => {
        console.warn('Reader auto-start in cobrar warning:', err);
      });
    } else {
      stopScanning().catch(() => {});
    }
    return () => {
      stopScanning().catch(() => {});
    };
  }, [session, isPaid]);

  function playChime() {
    try {
      const audioCtx = unlockAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {}
  }

  function handlePaymentReceived(data: {
    payer_name?: string;
    reference?: string;
    bank_code?: string;
    cardBrand?: string;
    maskedPan?: string;
    isCard?: boolean;
  }) {
    if (isPaidRef.current) return;
    setIsPaid(true);
    setPaidDetails({
      payer: data.payer_name || 'Cliente',
      ref: data.reference || 'FT-0134-REF-01',
      bank: data.bank_code || 'banesco',
      cardBrand: data.cardBrand,
      maskedPan: data.maskedPan,
      isCard: !!data.isCard,
    });

    playChime();

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
    }

    const currentSession = sessionRef.current;
    if (currentSession) {
      recordCollection(
        currentSession.amount,
        data.payer_name || 'Cliente',
        data.bank_code || (data.isCard ? 'tarjeta' : 'banesco'),
        data.reference || 'FT-0134-REF-01'
      );
    }

    // Disarm HCE and Reader on completion
    disarmSession().catch(() => {});
    stopScanning().catch(() => {});
  }

  // Handle physical contactless card discovery (SoftPOS mode)
  useEffect(() => {
    if (!discoveredTag || !session || isPaidRef.current) return;

    const rawTag = discoveredTag as any;
    let payload = rawTag.payload || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    const isPhysicalCard =
      rawTag.isPhysicalCard ||
      payload.isPhysicalCard ||
      rawTag.type === 'CONTACTLESS_CARD' ||
      payload.type === 'CONTACTLESS_CARD';

    if (isPhysicalCard) {
      const cardBrand =
        rawTag.cardBrand ||
        payload.cardBrand ||
        'Visa Débito Contactless';
      const maskedPan =
        rawTag.maskedPan ||
        payload.maskedPan ||
        '**** **** **** 8421';
      const cardUid =
        rawTag.cardUid ||
        payload.cardUid ||
        'NFC-CARD';
      const ref =
        rawTag.reference ||
        payload.reference ||
        `FT-CARD-${Date.now().toString(36).toUpperCase()}`;

      console.info('[Cobrar] Tarjeta contactless física detectada:', {
        cardBrand,
        maskedPan,
        cardUid,
      });

      handlePaymentReceived({
        payer_name: `${cardBrand} (${maskedPan})`,
        reference: ref,
        bank_code: 'tarjeta_contactless',
        cardBrand,
        maskedPan,
        isCard: true,
      });

      clearDiscoveredTag();
    }
  }, [discoveredTag, session]);

  // Supabase Realtime Fallback
  useEffect(() => {
    if (!session || isPaid) return;

    let channel: ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null = null;
    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      try {
        channel = supabase
          .channel(`charge_channel_${session.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'charge_sessions',
            },
            (payload) => {
              const row = payload.new as ChargeSession;
              if (row && row.id === session.id && row.status === 'paid') {
                handlePaymentReceived(row);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription fallback:', err);
      }
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [session, isPaid]);

  // When HCE physical payload transfer occurs, auto-complete payment on receiver
  useEffect(() => {
    if (isPayloadSent && session && !isPaid) {
      handlePaymentReceived({
        payer_name: 'Cliente NFC',
        reference: `FT-${(user?.default_bank || 'BANESCO').toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        bank_code: user?.default_bank || 'banesco',
      });
    }
  }, [isPayloadSent, session, isPaid]);

  function handleDigit(d: string) {
    if (amountStr.length >= 7) return;
    setAmountStr((prev) => prev + d);
  }

  function handleDelete() {
    setAmountStr((prev) => prev.slice(0, -1));
  }

  const numericAmount = parseFloat(amountStr) || 0;

  async function handleStartCharge() {
    if (numericAmount <= 0) return;
    unlockAudio();
    setIsCreating(true);

    try {
      const merchantName = user?.name || 'Comercio Fiscus';
      const merchantPhone = user?.phone || '04121234567';
      const sessionId = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newSession: ChargeSession = {
        id: sessionId,
        merchant_name: merchantName,
        merchant_phone: merchantPhone,
        amount: numericAmount,
        currency: 'VES',
        status: 'waiting',
        created_at: new Date().toISOString(),
      };

      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured()) {
        try {
          await supabase.from('charge_sessions').insert({
            id: sessionId,
            amount: numericAmount,
            merchant_name: merchantName,
            merchant_phone: merchantPhone,
            currency: 'VES',
            status: 'pending',
          });
        } catch (sbErr) {
          console.warn('Supabase session log:', sbErr);
        }
      }

      setSession(newSession);

      // Arm Phone A as HCE contactless terminal smart card
      await armSession({
        sessionId: newSession.id,
        amount: newSession.amount,
        currency: 'VES',
        merchantName,
        merchantPhone,
        bankCode: user?.default_bank || 'banesco',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar la sesión de cobro.';
      alert(msg);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSimulateCustomerTap() {
    if (!session) return;
    setSimulatingTap(true);
    try {
      // Simulate physical touch in browser
      (FiscusNfcBridge as any).simulateTapEvent?.({
        sessionId: session.id,
        amount: session.amount,
        currency: session.currency || 'VES',
        merchantName: session.merchant_name,
        merchantPhone: session.merchant_phone,
      });

      handlePaymentReceived({
        payer_name: 'Cliente Prueba Tap',
        bank_code: 'bdv',
        reference: `FT-BDV-${Date.now().toString(36).toUpperCase()}`,
        isCard: false,
      });
    } catch (err) {
      console.warn('Simulation tap error:', err);
    } finally {
      setSimulatingTap(false);
    }
  }

  async function handleSimulateCardTap(brand: string = 'Visa Débito Contactless') {
    if (!session) return;
    setSimulatingTap(true);
    try {
      const isMc = brand.toLowerCase().includes('mastercard') || brand.toLowerCase().includes('maestro');
      const mockPan = isMc ? '5*** **** **** 4912' : '4*** **** **** 8421';
      const mockRef = `FT-CARD-${Date.now().toString(36).toUpperCase()}`;

      if ((FiscusNfcBridge as any).simulateCardTap) {
        (FiscusNfcBridge as any).simulateCardTap({
          cardBrand: brand,
          maskedPan: mockPan,
          cardUid: '4BA2189F',
        });
      }

      handlePaymentReceived({
        payer_name: `${brand} (${mockPan})`,
        bank_code: 'tarjeta_contactless',
        reference: mockRef,
        cardBrand: brand,
        maskedPan: mockPan,
        isCard: true,
      });
    } catch (err) {
      console.warn('Simulation card error:', err);
    } finally {
      setSimulatingTap(false);
    }
  }

  function resetCharge() {
    disarmSession().catch(() => {});
    stopScanning().catch(() => {});
    setSession(null);
    setIsPaid(false);
    setPaidDetails(null);
    setAmountStr('');
    clearDiscoveredTag();
  }

  return (
    <main className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col justify-between py-10 px-6 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4">
        <button
          type="button"
          onClick={handleGoToWallet}
          className="text-[15px] font-medium text-[#0071e3] hover:text-[#0077ed] active:opacity-70 transition-all flex items-center gap-1 py-1 px-1 -ml-1 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Mi Billetera</span>
        </button>
        <span className="text-[12px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Terminal Fiscus SoftPOS
        </span>
        <div className="w-12" />
      </div>

      {/* STATE 1: AMOUNT KEYPAD */}
      {!session && (
        <div className="py-6 space-y-8 animate-fadeIn">
          {/* Display Amount */}
          <div className="text-center space-y-1">
            <span className="text-[14px] font-medium text-[#86868b] tracking-[-0.01em]">
              Monto a cobrar
            </span>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-semibold text-[#86868b]">Bs.</span>
              <span className="text-5xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
                {numericAmount > 0
                  ? numericAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 })
                  : '0,00'}
              </span>
            </div>
            {user?.name && (
              <p className="text-[13px] text-[#86868b] pt-1">
                Comercio: <span className="text-[#1d1d1f] font-medium">{user.name}</span>
                {user.phone && ` (${user.phone})`}
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex justify-center gap-2">
            {[50, 100, 250, 500].map((preset) => (
              <motion.button
                whileTap={{ scale: 0.94 }}
                transition={tactileSpring}
                key={preset}
                type="button"
                onClick={() => setAmountStr(String(preset))}
                className="px-4 py-1.5 rounded-full bg-white border border-black/[0.06] text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.02] shadow-sm transition-all"
              >
                Bs. {preset}
              </motion.button>
            ))}
          </div>

          {/* Numeric Keypad (Apple Style) */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <motion.button
                whileTap={{ scale: 0.92 }}
                transition={tactileSpring}
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-16 rounded-2xl bg-white border border-black/[0.04] text-2xl font-medium text-[#1d1d1f] transition-all shadow-sm"
              >
                {digit}
              </motion.button>
            ))}
            <div />
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={tactileSpring}
              type="button"
              onClick={() => handleDigit('0')}
              className="h-16 rounded-2xl bg-white border border-black/[0.04] text-2xl font-medium text-[#1d1d1f] transition-all shadow-sm"
            >
              0
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={tactileSpring}
              type="button"
              onClick={handleDelete}
              className="h-16 rounded-2xl bg-white border border-black/[0.04] text-[15px] font-medium text-[#86868b] transition-all flex items-center justify-center shadow-sm"
            >
              Borrar
            </motion.button>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={tactileSpring}
            type="button"
            disabled={numericAmount <= 0 || isCreating}
            onClick={handleStartCharge}
            className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isCreating ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              '⚡ Activar Terminal NFC / Tarjetas'
            )}
          </motion.button>
        </div>
      )}

      {/* STATE 2: ACTIVE CONTACTLESS TERMINAL (WAITING FOR CARD OR PHONE TAP) */}
      {session && !isPaid && (
        <div className="py-6 space-y-6 text-center animate-fadeIn">
          {/* Amount Header */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
              Terminal Contactless Activo (SoftPOS)
            </div>
            <div className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f] pt-1">
              Bs. {session.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[13px] text-[#86868b]">{session.merchant_name}</p>
          </div>

          {/* Contactless Physical Touch Radar */}
          <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
            {/* 3 Concentric Staggered Ripple Rings */}
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="absolute inset-0 rounded-full border-2 border-[#0071e3]/30 bg-[#0071e3]/10"
                initial={{ scale: 0.8, opacity: 0.7 }}
                animate={{
                  scale: [0.8, 1.45, 2.0],
                  opacity: [0.7, 0.3, 0],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: index * 0.5,
                  ease: 'easeOut',
                }}
                style={{ willChange: 'transform, opacity' }}
              />
            ))}

            {/* Central Terminal Icon */}
            <div className="relative w-28 h-28 rounded-full bg-white border border-black/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col items-center justify-center gap-1.5 z-10">
              <svg
                className="w-9 h-9 text-[#0071e3]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <span className="text-[11px] font-semibold tracking-tight text-[#1d1d1f]">
                {isPayloadSent ? '¡Toque detectado!' : 'Acerca tarjeta o cel'}
              </span>
            </div>
          </div>

          {/* User Instructions */}
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-2 text-center shadow-sm">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">
              Pasa la tarjeta contactless o acerca el teléfono
            </p>
            <p className="text-[12px] text-[#86868b] leading-relaxed">
              Coloca cualquier tarjeta de débito o crédito Visa, Mastercard, Maestro o acerca el teléfono del cliente a la parte trasera de este celular.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] text-[11px] font-medium text-[#1d1d1f]">
                💳 Visa / Mastercard / Maestro
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/[0.04] text-[11px] font-medium text-[#1d1d1f]">
                📱 Teléfonos NFC
              </span>
            </div>
            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#34c759] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#34c759] animate-ping" />
              <span>Lector NFC 13.56 MHz Activo (SoftPOS Certificable)</span>
            </div>
          </div>

          {/* Testing / Demo Action Triggers */}
          <div className="space-y-2 pt-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={tactileSpring}
              type="button"
              disabled={simulatingTap}
              onClick={() => handleSimulateCardTap('Visa Débito Contactless')}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#1d1d1f] hover:bg-black text-[14px] font-semibold text-white transition-all shadow-[0_2px_8px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 cursor-pointer"
            >
              {simulatingTap ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                '💳 Simular pase de Tarjeta (Visa / Mastercard)'
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={tactileSpring}
              type="button"
              disabled={simulatingTap}
              onClick={handleSimulateCustomerTap}
              className="w-full py-2.5 px-4 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] text-[13px] font-medium text-[#1d1d1f] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              📱 Simular toque de celular (Demostración)
            </motion.button>

            <button
              type="button"
              onClick={resetCharge}
              className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] transition-colors py-1 block mx-auto cursor-pointer"
            >
              Cancelar cobro
            </button>
          </div>
        </div>
      )}

      {/* STATE 3: PAYMENT RECEIVED (SUCCESS RECEIPT) */}
      {isPaid && paidDetails && (
        <div className="py-8 space-y-8 text-center animate-fadeIn">
          <motion.div
            className="w-20 h-20 mx-auto rounded-full bg-[#34c759]/10 border border-[#34c759]/25 flex items-center justify-center text-[#34c759] shadow-sm"
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={triumphantSpring}
          >
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
              <motion.path
                d="M5 13l4 4L19 7"
                stroke="#34c759"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: 0.12 }}
              />
            </svg>
          </motion.div>

          <div className="space-y-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#34c759]">
              {paidDetails.isCard ? '¡Tarjeta Contactless Cobrada!' : '¡Cobro Confirmado por NFC!'}
            </span>
            <div className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
              Bs. {session?.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[14px] text-[#86868b]">
              {paidDetails.isCard ? paidDetails.cardBrand || 'Tarjeta Débito / Crédito' : `Recibido de ${paidDetails.payer}`}
            </p>
          </div>

          {/* Receipt details */}
          <motion.div
            variants={receiptCardVariants}
            initial="hidden"
            animate="visible"
            className="p-5 rounded-2xl bg-white border border-black/[0.06] space-y-3 text-left text-[14px] shadow-sm"
          >
            {paidDetails.isCard ? (
              <>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Método de Pago</span>
                  <span className="font-semibold text-[#1d1d1f]">Tarjeta Contactless EMV</span>
                </motion.div>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Marca / Producto</span>
                  <span className="text-[#1d1d1f]">{paidDetails.cardBrand || 'Visa Débito Contactless'}</span>
                </motion.div>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Número de Tarjeta</span>
                  <span className="font-mono text-[#1d1d1f] font-semibold">{paidDetails.maskedPan || '**** **** **** 8421'}</span>
                </motion.div>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Autorización / Ref</span>
                  <span className="font-mono text-[#1d1d1f] font-semibold">{paidDetails.ref}</span>
                </motion.div>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Canal</span>
                  <span className="text-[#1d1d1f]">NFC SoftPOS (ISO 14443-A/B)</span>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Referencia Bancaria</span>
                  <span className="font-mono text-[#1d1d1f] font-semibold">{paidDetails.ref}</span>
                </motion.div>
                <motion.div variants={receiptItemVariants} className="flex justify-between">
                  <span className="text-[#86868b]">Canal de Transferencia</span>
                  <span className="text-[#1d1d1f]">NFC HCE Directo (ISO 7816-4)</span>
                </motion.div>
              </>
            )}
            <motion.div variants={receiptItemVariants} className="flex justify-between">
              <span className="text-[#86868b]">Fecha y hora</span>
              <span className="text-[#1d1d1f]">{new Date().toLocaleTimeString('es-VE')}</span>
            </motion.div>
          </motion.div>

          <div className="space-y-3">
            <Receipt
              result={{
                success: true,
                reference: paidDetails.ref,
                amount: session?.amount || 0,
                merchant_name: session?.merchant_name || 'Comercio Fiscus',
                timestamp: new Date().toISOString(),
                bank_code: paidDetails.bank || 'tarjeta_contactless',
                message: paidDetails.isCard
                  ? `Cobro con Tarjeta Contactless (${paidDetails.cardBrand || 'EMV'})`
                  : 'Cobro recibido por NFC',
              }}
            />

            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={tactileSpring}
              type="button"
              onClick={handleGoToWallet}
              className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black transition-all shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Volver a Mi Billetera</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={tactileSpring}
              type="button"
              onClick={resetCharge}
              className="w-full py-3.5 rounded-2xl border border-black/[0.08] text-[14px] font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.02] transition-colors cursor-pointer"
            >
              Listo · Realizar otro cobro
            </motion.button>
          </div>
        </div>
      )}

      {/* Footer subtle brand */}
      <div className="text-center pt-4">
        <span className="text-[11px] text-[#aeaeb2] tracking-[0.08em] uppercase">
          Fiscus Tap · SoftPOS & Pago Móvil Contactless
        </span>
      </div>
    </main>
  );
}
