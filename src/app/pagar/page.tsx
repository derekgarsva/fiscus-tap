'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, recordPayment, getWalletBalance } from '@/lib/wallet-store';
import { ChargeSession, UserProfile } from '@/types';
import { generateBankingReference } from '@/lib/banking-reference';
import { useNfcReader, FiscusNfcBridge, isIos, isNativeIos, type TagDiscoveredEvent } from '@/lib/nfc-bridge';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Receipt } from '@/components/Receipt';
import { motion } from 'framer-motion';
import {
  triumphantSpring,
  receiptCardVariants,
  receiptItemVariants,
  tactileSpring,
} from '@/lib/motion-config';

export default function PagarPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [nearbySession, setNearbySession] = useState<ChargeSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);
  const [simulatingReaderTap, setSimulatingReaderTap] = useState(false);
  const [insufficientFundsError, setInsufficientFundsError] = useState<string | null>(null);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isNativeIosDevice, setIsNativeIosDevice] = useState(false);

  const [paidResult, setPaidResult] = useState<{
    success: boolean;
    reference: string;
    amount: number;
    merchant_name: string;
    timestamp: string;
    bank_code: string;
    message: string;
  } | null>(null);

  // Initialize Native / Web IsoDep Reader Mode
  const { isScanning, discoveredTag, startScanning, stopScanning, clearDiscoveredTag } = useNfcReader({
    timeoutMs: 15000,
  });

  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  const autoPayRef = useRef(true);
  autoPayRef.current = autoPayEnabled;

  function handleGoToWallet() {
    stopScanning().catch(() => {});
    router.push('/');
  }

  useEffect(() => {
    const profile = getUserProfile();
    setUser(profile);
    setBalance(getWalletBalance());
    setIsIosDevice(isIos());
    setIsNativeIosDevice(isNativeIos());

    // Auto-start Reader Mode so the phone is ready for physical touch
    startScanning().catch((err) => {
      console.warn('Reader auto-start warning:', err);
    });

    return () => {
      stopScanning().catch(() => {});
    };
  }, []); // Run once on mount to avoid re-triggering and freeze

  // Handle hardware tag discovered via NFC RF field
  useEffect(() => {
    if (!discoveredTag) return;

    // Haptic feedback on physical touch (safely guarded for iOS Safari/WebKit)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([120, 60, 120]);
      } catch {}
    }

    const rawTag = discoveredTag as any;
    let payload = rawTag.payload || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    let rawPayloadObj: any = {};
    if (typeof rawTag.rawPayload === 'string') {
      try {
        rawPayloadObj = JSON.parse(rawTag.rawPayload);
      } catch {}
    }

    const sessionId =
      rawTag.sessionId ||
      payload.sessionId ||
      rawPayloadObj.sessionId ||
      `cs_${Date.now()}`;

    const rawAmt =
      rawTag.amount !== undefined && rawTag.amount !== null
        ? rawTag.amount
        : payload.amount !== undefined && payload.amount !== null
          ? payload.amount
          : rawPayloadObj.amount;

    const parsedAmt = typeof rawAmt === 'number' ? rawAmt : (parseFloat(rawAmt) || 0);

    const merchantName =
      rawTag.merchantName ||
      payload.merchantName ||
      rawPayloadObj.merchantName ||
      'Comercio Fiscus';

    const merchantPhone =
      rawTag.merchantPhone ||
      payload.merchantPhone ||
      rawPayloadObj.merchantPhone ||
      '';

    const currency =
      rawTag.currency ||
      payload.currency ||
      rawPayloadObj.currency ||
      'VES';

    console.info('[Pagar] Hardware Tag Parsed:', { sessionId, parsedAmt, merchantName });

    const sessionFromTag: ChargeSession = {
      id: sessionId,
      merchant_name: merchantName,
      merchant_phone: merchantPhone,
      amount: parsedAmt,
      currency: currency,
      status: 'waiting',
      created_at: new Date().toISOString(),
    };

    setNearbySession(sessionFromTag);

    // Instant payment without thinking
    if (!isProcessingRef.current) {
      executePayment(sessionFromTag);
    }
  }, [discoveredTag]);

  async function executePayment(chargeToPay?: ChargeSession) {
    const target = chargeToPay || nearbySession;
    if (!target || isProcessingRef.current) return;

    if (target.amount <= 0) {
      console.warn('[Pagar] Monto inválido para procesar pago:', target);
      return;
    }

    setInsufficientFundsError(null);

    const currentBal = getWalletBalance();
    if (currentBal < target.amount) {
      setInsufficientFundsError(
        `Saldo insuficiente: Tienes Bs. ${currentBal.toLocaleString('es-VE', { minimumFractionDigits: 2 })} y el cobro es de Bs. ${target.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}.`
      );
      return;
    }

    setIsProcessing(true);

    try {
      const bankCode = user?.default_bank || 'bdv';
      const payerName = user?.name || 'Cliente Fiscus';
      const payerPhone = user?.phone || '04149876543';

      // Generate Venezuelan SUDEBAN standard reference
      const ref = generateBankingReference({
        bankCode,
        sessionId: target.id,
        payerPhone,
        amount: target.amount,
      });

      // 1. DEDUCT FUNDS FROM LOCAL WALLET IMMEDIATELY (Instant execution!)
      recordPayment(target.amount, target.merchant_name, bankCode, ref);
      const nextBalance = getWalletBalance();
      setBalance(nextBalance);

      // 2. Audio & Haptic confirmation
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 80, 150]);
      }

      setPaidResult({
        success: true,
        reference: ref,
        amount: target.amount,
        merchant_name: target.merchant_name,
        timestamp: new Date().toISOString(),
        bank_code: bankCode,
        message: 'Pago transferido exitosamente por NFC con 1 toque',
      });

      setNearbySession(null);
      clearDiscoveredTag();

      // 3. Confirm transaction in Supabase in background (Non-blocking!)
      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured()) {
        (async () => {
          try {
            await supabase.from('charge_sessions').update({
              status: 'paid',
              payer_name: payerName,
              payer_phone: payerPhone,
              reference: ref,
              bank_code: bankCode,
              completed_at: new Date().toISOString(),
            }).eq('id', target.id);
          } catch (sbErr) {
            console.warn('Supabase charge update:', sbErr);
          }
        })();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar el pago';
      alert(msg);
    } finally {
      setIsProcessing(false);
    }
  }

  // Developer / Web simulation helper
  function handleSimulateTerminalTouch() {
    setSimulatingReaderTap(true);
    try {
      const mockSessionId = `ch_sim_${Date.now().toString(36)}`;
      const mockAmount = 75.00;
      const mockMerchant = 'Panadería & Café Fiscus';
      const mockPhone = '04129998877';

      // Simulate tag discovered through the bridge
      (FiscusNfcBridge as any).simulateTapEvent?.({
        sessionId: mockSessionId,
        amount: mockAmount,
        currency: 'VES',
        merchantName: mockMerchant,
        merchantPhone: mockPhone,
      });
    } catch (err) {
      console.warn('Simulation reader tap error:', err);
    } finally {
      setSimulatingReaderTap(false);
    }
  }

  function handleReset() {
    setPaidResult(null);
    setNearbySession(null);
    setInsufficientFundsError(null);
    clearDiscoveredTag();
    startScanning().catch(() => {});
  }

  return (
    <main className="min-h-[100dvh] w-full max-w-md mx-auto flex flex-col justify-between py-6 px-5 pt-safe pb-safe overflow-x-hidden bg-[#fbfbfd] text-[#1d1d1f]">
      {/* Header */}
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
          Pagar con NFC
        </span>
        <div className="w-12" />
      </div>

      {/* Main Content Area */}
      <div className="py-2 space-y-6 animate-fadeIn">
        {/* User Balance Glance */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
          <div>
            <span className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider block">
              Saldo Disponible
            </span>
            <span className="text-xl font-bold font-mono text-[#1d1d1f]">
              Bs. {balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[12px] font-medium text-[#1d1d1f] block">
              {user?.name || 'Cliente Fiscus'}
            </span>
            <span className="text-[11px] text-[#86868b] uppercase">
              {user?.default_bank?.toUpperCase() || 'BDV'} · {user?.phone || '04149876543'}
            </span>
          </div>
        </div>

        {/* STATE 1: CONTACTLESS TAG DETECTED (Touch Hero Card) */}
        {nearbySession && !paidResult && (
          <div className="p-6 rounded-3xl bg-white border border-black/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.08)] space-y-5 text-center animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#34c759]/10 text-[#34c759] text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
              Terminal Contactless Detectado
            </div>

            <div className="space-y-1">
              <span className="text-[13px] text-[#86868b] block">Comercio</span>
              <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
                {nearbySession.merchant_name}
              </h2>
              {nearbySession.merchant_phone && (
                <p className="text-[12px] text-[#86868b]">{nearbySession.merchant_phone}</p>
              )}
              <div className="text-4xl font-bold font-mono text-[#1d1d1f] pt-2">
                Bs. {nearbySession.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {insufficientFundsError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] leading-relaxed">
                {insufficientFundsError}
              </div>
            )}

            {/* 1-Touch Action Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={tactileSpring}
              type="button"
              disabled={isProcessing}
              onClick={() => executePayment()}
              className="w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-semibold text-[16px] hover:bg-black transition-all shadow-[0_4px_14px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Transfiriendo por NFC...
                </>
              ) : (
                'PAGAR CON 1 TOQUE'
              )}
            </motion.button>

            <button
              type="button"
              onClick={() => {
                setNearbySession(null);
                setInsufficientFundsError(null);
                clearDiscoveredTag();
              }}
              className="text-[12px] text-[#86868b] hover:text-[#1d1d1f]"
            >
              Cancelar pago
            </button>
          </div>
        )}

        {/* STATE 2: ACTIVE CONTACTLESS READER MODE (Waiting for physical touch) */}
        {!nearbySession && !paidResult && (
          <div className="py-6 space-y-6 text-center animate-fadeIn">
            {/* Pulsing Contactless Waves Animation */}
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

              {/* Central Phone Tap Icon */}
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
                  <path d="M12 2v4" />
                  <path d="m4.93 4.93 2.83 2.83" />
                  <path d="M2 12h4" />
                  <path d="m4.93 19.07 2.83-2.83" />
                  <rect x="9" y="8" width="10" height="14" rx="2" />
                </svg>
                <span className="text-[11px] font-semibold text-[#1d1d1f]">
                  Listo para tocar
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl text-[#1d1d1f] tracking-tight">
                {isNativeIosDevice
                  ? 'Acerca la parte superior de tu iPhone'
                  : isIosDevice
                  ? 'Pagar desde iPhone'
                  : 'Acerca tu celular al cobrador'}
              </h3>
              <p className="text-[13px] text-[#86868b] max-w-xs mx-auto leading-relaxed">
                {isNativeIosDevice
                  ? 'El sensor NFC de Apple está en el borde superior de tu iPhone. Acércalo al otro teléfono o terminal.'
                  : isIosDevice
                  ? 'Safari Web no permite NFC directo. Apunta tu cámara nativa al código QR del cobrador o ingresa el código.'
                  : 'Junta la parte trasera de tu teléfono con la del otro celular para transferir el pago por NFC.'}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-black/[0.06] text-[12px] text-[#86868b] space-y-1 shadow-sm">
              <div className="flex items-center justify-center gap-1.5 text-[#34c759] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#34c759] animate-ping" />
                <span>
                  {isNativeIosDevice
                    ? 'Lector CoreNFC Activo en iPhone'
                    : isIosDevice
                    ? 'Modo Cámara / QR Activo'
                    : 'Modo Lector NFC Activo · AID F046495343555301'}
                </span>
              </div>
              <p className="text-[11px] text-[#86868b]">
                {isIosDevice && !isNativeIosDevice
                  ? 'Compatible con la cámara nativa de iOS sin necesidad de instalar nada adicional.'
                  : 'Canal seguro ISO 7816-4 sin choosers de billetera ni cuadros de diálogo del sistema.'}
              </p>
            </div>

            <div className="space-y-3 max-w-xs mx-auto pt-2">
              {isIosDevice && !isNativeIosDevice && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  transition={tactileSpring}
                  type="button"
                  onClick={() => {
                    const slug = prompt('Ingresa el código o identificador del cobro (ej. demo, sharky):');
                    if (slug) router.push(`/t/${slug.trim()}`);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-white border border-black/[0.08] text-[#0071e3] font-semibold text-[14px] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  🔍 Ingresar Código de Cobro
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.96 }}
                transition={tactileSpring}
                type="button"
                disabled={simulatingReaderTap}
                onClick={handleSimulateTerminalTouch}
                className="w-full py-3.5 rounded-2xl bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f] font-semibold text-[14px] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {simulatingReaderTap ? (
                  <div className="w-4 h-4 border-2 border-[#1d1d1f] border-t-transparent rounded-full animate-spin" />
                ) : (
                  '⚡ Simular toque a terminal (Demostración)'
                )}
              </motion.button>

              <label className="flex items-center justify-center gap-2 text-[12px] text-[#86868b] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoPayEnabled}
                  onChange={(e) => setAutoPayEnabled(e.target.checked)}
                  className="accent-[#1d1d1f] w-4 h-4 rounded"
                />
                <span>Pagar automáticamente con 1 solo toque</span>
              </label>
            </div>
          </div>
        )}

        {/* STATE 3: PAYMENT CONFIRMED (SUCCESS RECEIPT) */}
        {paidResult && (
          <div className="space-y-6 text-center animate-fadeIn py-4">
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
                ¡Pago Enviado por NFC!
              </span>
              <div className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
                Bs. {paidResult.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[14px] text-[#86868b]">Pagado a {paidResult.merchant_name}</p>
            </div>

            <motion.div
              variants={receiptCardVariants}
              initial="hidden"
              animate="visible"
              className="p-5 rounded-2xl bg-white border border-black/[0.06] space-y-3 text-left text-[14px] shadow-sm"
            >
              <motion.div variants={receiptItemVariants} className="flex justify-between">
                <span className="text-[#86868b]">Referencia Bancaria</span>
                <span className="font-mono text-[#1d1d1f] font-semibold">{paidResult.reference}</span>
              </motion.div>
              <motion.div variants={receiptItemVariants} className="flex justify-between">
                <span className="text-[#86868b]">Canal de Envío</span>
                <span className="text-[#1d1d1f]">Contactless Hardware NFC (APDU)</span>
              </motion.div>
              <motion.div variants={receiptItemVariants} className="flex justify-between">
                <span className="text-[#86868b]">Nuevo Saldo</span>
                <span className="font-mono text-[#1d1d1f] font-semibold">
                  Bs. {balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </motion.div>
              <motion.div variants={receiptItemVariants} className="flex justify-between">
                <span className="text-[#86868b]">Hora</span>
                <span className="text-[#1d1d1f]">{new Date(paidResult.timestamp).toLocaleTimeString('es-VE')}</span>
              </motion.div>
            </motion.div>

            <div className="space-y-3">
              <Receipt result={paidResult} />
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
                onClick={handleReset}
                className="w-full py-3.5 rounded-2xl border border-black/[0.08] text-[14px] font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.02] transition-colors cursor-pointer"
              >
                Hacer otro pago
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-4">
        <span className="text-[11px] text-[#aeaeb2] tracking-[0.08em] uppercase">
          Fiscus Tap · Pago Móvil Contactless Directo
        </span>
      </div>
    </main>
  );
}
