'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserProfile, recordCollection } from '@/lib/wallet-store';
import { ChargeSession, UserProfile } from '@/types';
import { isNFCSupported, writeNFCTag } from '@/lib/nfc';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export default function CobrarPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [session, setSession] = useState<ChargeSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidDetails, setPaidDetails] = useState<{ payer: string; ref: string } | null>(null);
  const [nfcWriting, setNfcWriting] = useState(false);
  const [nfcWritten, setNfcWritten] = useState(false);
  const [viewMode, setViewMode] = useState<'nfc' | 'qr'>('nfc');

  useEffect(() => {
    const profile = getUserProfile();
    setUser(profile);
  }, []);

  function handlePaymentReceived(data: { payer_name?: string; reference?: string; bank_code?: string }) {
    if (isPaid) return;
    setIsPaid(true);
    setPaidDetails({
      payer: data.payer_name || 'Cliente',
      ref: data.reference || 'FT-REF',
    });

    // Play subtle success sound
    playChime();

    // Haptic vibration on supported devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
    }

    // Record in local wallet transactions
    if (session) {
      recordCollection(
        session.amount,
        data.payer_name || 'Cliente',
        data.bank_code || 'banesco',
        data.reference || 'FT-REF'
      );
    }
  }

  // Supabase Realtime + Polling Fallback
  useEffect(() => {
    if (!session || isPaid) return;

    // 1. Supabase Realtime WebSocket Channel
    let channel: ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null = null;
    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      try {
        channel = supabase
          .channel(`charge_${session.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'charge_sessions',
              filter: `id=eq.${session.id}`,
            },
            (payload) => {
              if (payload.new && (payload.new as ChargeSession).status === 'paid') {
                handlePaymentReceived(payload.new as ChargeSession);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription fallback to polling:', err);
      }
    }

    // 2. Resilient Polling Fallback (1.5s interval)
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/charges/${session.id}`);
        if (!res.ok) return;
        const data: ChargeSession = await res.json();

        if (data.status === 'paid') {
          handlePaymentReceived(data);
          clearInterval(interval);
        }
      } catch {}
    }, 1500);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [session, isPaid]);

  function playChime() {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    setIsCreating(true);

    try {
      const res = await fetch('/api/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numericAmount,
          merchant_name: user?.name || 'Comercio Fiscus',
          merchant_phone: user?.phone || '',
        }),
      });

      if (!res.ok) throw new Error('Error al crear cobro');
      const data: ChargeSession = await res.json();
      setSession(data);
    } catch (err) {
      alert('No se pudo iniciar la sesión de cobro.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleWriteTag() {
    if (!session) return;
    setNfcWriting(true);
    try {
      await writeNFCTag(session.id);
      setNfcWritten(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al escribir el tag NFC');
    } finally {
      setNfcWriting(false);
    }
  }

  function resetCharge() {
    setSession(null);
    setIsPaid(false);
    setPaidDetails(null);
    setAmountStr('');
    setNfcWritten(false);
    setViewMode('nfc');
  }

  const payUrl = session ? `${typeof window !== 'undefined' ? window.location.origin : ''}/t/${session.id}` : '';

  return (
    <main className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col justify-between py-10 px-6 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-[14px] text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1"
        >
          ‹ Billetera
        </Link>
        <span className="text-[12px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Terminal Fiscus
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
                {numericAmount > 0 ? numericAmount.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '0,00'}
              </span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex justify-center gap-2">
            {[50, 100, 250, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountStr(String(preset))}
                className="px-4 py-1.5 rounded-full bg-white border border-black/[0.06] text-[13px] font-medium text-[#1d1d1f] hover:bg-black/[0.02] shadow-sm transition-all"
              >
                Bs. {preset}
              </button>
            ))}
          </div>

          {/* Numeric Keypad (Apple Style) */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-16 rounded-2xl bg-white border border-black/[0.04] text-2xl font-medium text-[#1d1d1f] active:bg-[#f5f5f7] transition-all shadow-sm"
              >
                {digit}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-16 rounded-2xl bg-white border border-black/[0.04] text-2xl font-medium text-[#1d1d1f] active:bg-[#f5f5f7] transition-all shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-16 rounded-2xl bg-white border border-black/[0.04] text-[15px] font-medium text-[#86868b] active:bg-[#f5f5f7] transition-all flex items-center justify-center shadow-sm"
            >
              Borrar
            </button>
          </div>

          <button
            type="button"
            disabled={numericAmount <= 0 || isCreating}
            onClick={handleStartCharge}
            className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Cobrar con Tap NFC'
            )}
          </button>
        </div>
      )}

      {/* STATE 2: ACTIVE CHARGE WAITING FOR TAP OR QR */}
      {session && !isPaid && (
        <div className="py-6 space-y-6 text-center animate-fadeIn">
          {/* Mode Selector Pill: NFC vs QR */}
          <div className="inline-flex p-1 rounded-2xl bg-black/[0.05] border border-black/[0.04]">
            <button
              type="button"
              onClick={() => setViewMode('nfc')}
              className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
                viewMode === 'nfc'
                  ? 'bg-white text-[#1d1d1f] shadow-sm'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              📱 Tap NFC
            </button>
            <button
              type="button"
              onClick={() => setViewMode('qr')}
              className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
                viewMode === 'qr'
                  ? 'bg-white text-[#1d1d1f] shadow-sm'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              📷 Código QR
            </button>
          </div>

          {viewMode === 'nfc' ? (
            <div className="space-y-6">
              {/* Amount Display */}
              <div className="space-y-1">
                <span className="text-[13px] font-medium text-[#86868b] uppercase tracking-[0.08em]">
                  Esperando Pago
                </span>
                <div className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
                  Bs. {session.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[13px] text-[#86868b]">{session.merchant_name}</p>
              </div>

              {/* Animated Apple NFC Radar */}
              <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#0071e3]/5 animate-ping duration-1000" />
                <div className="absolute inset-4 rounded-full bg-[#0071e3]/10 animate-apple-pulse" />
                <div className="relative w-28 h-28 rounded-full bg-white border border-black/[0.06] shadow-apple-card flex flex-col items-center justify-center gap-1">
                  <svg
                    className="w-8 h-8 text-[#0071e3]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  <span className="text-[11px] font-medium tracking-tight text-[#86868b]">
                    Acerca el celular
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-2 text-left shadow-apple-sm">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#86868b]">Enlace de este cobro:</span>
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0071e3] font-medium hover:underline text-[12px]"
                  >
                    Abrir en este teléfono ↗
                  </a>
                </div>
                <div className="text-[11px] text-[#86868b] break-all font-mono bg-[#f5f5f7] p-2 rounded-lg">
                  {payUrl}
                </div>
              </div>

              {/* NFC Hardware button if Web NFC is supported */}
              {isNFCSupported() && (
                <button
                  type="button"
                  onClick={handleWriteTag}
                  disabled={nfcWriting || nfcWritten}
                  className="w-full py-3 rounded-2xl border border-black/[0.08] text-[14px] font-medium text-[#1d1d1f] hover:bg-black/[0.02] transition-colors"
                >
                  {nfcWriting
                    ? 'Acerca sticker NFC para grabar...'
                    : nfcWritten
                    ? '✓ Grabado en Sticker NFC'
                    : 'Escribir enlace en Tag NFC físico'}
                </button>
              )}
            </div>
          ) : (
            <QRCodeDisplay url={payUrl} amount={session.amount} />
          )}

          <button
            type="button"
            onClick={resetCharge}
            className="text-[14px] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
          >
            Cancelar cobro
          </button>
        </div>
      )}

      {/* STATE 3: PAYMENT RECEIVED (SUCCESS) */}
      {isPaid && paidDetails && (
        <div className="py-8 space-y-8 text-center animate-fadeIn">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#34c759]/10 border border-[#34c759]/20 flex items-center justify-center text-[#34c759] shadow-sm">
            <svg
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#34c759]">
              ¡Cobro Confirmado!
            </span>
            <div className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
              Bs. {session?.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[14px] text-[#86868b]">
              Recibido de {paidDetails.payer}
            </p>
          </div>

          {/* Receipt details */}
          <div className="p-5 rounded-2xl bg-white border border-black/[0.06] space-y-3 text-left text-[14px] shadow-apple-sm">
            <div className="flex justify-between">
              <span className="text-[#86868b]">Referencia</span>
              <span className="font-mono text-[#1d1d1f] font-semibold">{paidDetails.ref}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#86868b]">Método</span>
              <span className="text-[#1d1d1f]">Pago Móvil C2P</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#86868b]">Fecha y hora</span>
              <span className="text-[#1d1d1f]">{new Date().toLocaleTimeString('es-VE')}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={resetCharge}
            className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            Listo · Realizar otro cobro
          </button>
        </div>
      )}

      {/* Footer subtle brand */}
      <div className="text-center pt-4">
        <span className="text-[11px] text-[#aeaeb2] tracking-[0.08em] uppercase">
          Fiscus Tap · Pagos Físicos de Próxima Generación
        </span>
      </div>
    </main>
  );
}
