'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { getUserProfile, recordPayment, getWalletBalance } from '@/lib/wallet-store';
import { ChargeSession, UserProfile } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { isNFCSupported, readNFCTag } from '@/lib/nfc';
import { Receipt } from '@/components/Receipt';

export default function PagarPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [nearbySession, setNearbySession] = useState<ChargeSession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paidResult, setPaidResult] = useState<{
    success: boolean;
    reference: string;
    amount: number;
    merchant_name: string;
    timestamp: string;
    bank_code: string;
    message: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(true);

  useEffect(() => {
    const profile = getUserProfile();
    setUser(profile);
    setBalance(getWalletBalance());
    checkNearbyCharges();
    subscribeToNearbyCharges();
    startNfcReader();

    return () => {
      stopCamera();
    };
  }, []);

  // 1. Detect active charges in Supabase
  async function checkNearbyCharges() {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return;

    try {
      const tenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('charge_sessions')
        .select('*')
        .eq('status', 'waiting')
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setNearbySession(data[0] as ChargeSession);
      }
    } catch {}
  }

  // 2. Realtime subscription for incoming charges
  function subscribeToNearbyCharges() {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return;

    try {
      supabase
        .channel('nearby_radar')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'charge_sessions' },
          (payload) => {
            const newSession = payload.new as ChargeSession;
            if (newSession && newSession.status === 'waiting') {
              setNearbySession(newSession);
              // Haptic alert when charge detected
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(80);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'charge_sessions' },
          (payload) => {
            const updated = payload.new as ChargeSession;
            if (updated && updated.status === 'paid' && nearbySession?.id === updated.id) {
              setNearbySession(null);
            }
          }
        )
        .subscribe();
    } catch {}
  }

  // 3. Web NFC reader fallback
  function startNfcReader() {
    if (!isNFCSupported()) return;
    try {
      readNFCTag((url) => {
        if (url) {
          handleUrlDetected(url);
        }
      });
    } catch {}
  }

  // 4. Integrated Fast Camera Scanner
  async function startCamera() {
    setCameraError('');
    setCameraActive(true);
    isScanningRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      setCameraError('Permiso de cámara requerido para escanear');
      setCameraActive(false);
    }
  }

  function stopCamera() {
    isScanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function tickScan() {
    if (!isScanningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          stopCamera();
          handleUrlDetected(code.data);
          return;
        }
      }
    }

    if (isScanningRef.current) {
      animFrameRef.current = requestAnimationFrame(tickScan);
    }
  }

  async function handleUrlDetected(url: string) {
    try {
      // Extract session ID or slug from URL (e.g. /t/ch_123 or https://.../t/ch_123)
      const match = url.match(/\/t\/([^/?#]+)/);
      const slugOrId = match ? match[1] : url.trim();

      const res = await fetch(`/api/charges/${slugOrId}`);
      if (!res.ok) throw new Error('Cobro no encontrado');
      const data: ChargeSession = await res.json();

      setNearbySession(data);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      // If Auto-Pay is enabled, execute payment immediately!
      if (autoPayEnabled) {
        executePayment(data);
      }
    } catch {
      alert('Código o enlace no válido');
    }
  }

  async function executePayment(chargeToPay?: ChargeSession) {
    const target = chargeToPay || nearbySession;
    if (!target || isProcessing) return;

    setIsProcessing(true);

    try {
      const bankCode = user?.default_bank || 'banesco';
      const payerName = user?.name || 'Cliente Fiscus';
      const ref = `FT-${Date.now().toString(36).toUpperCase()}`;

      // 1. Confirm charge in Supabase via API
      const res = await fetch(`/api/charges/${target.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_code: bankCode,
          payer_name: payerName,
          reference: ref,
        }),
      });

      if (!res.ok) throw new Error('Error al procesar el pago');

      // 2. Deduct funds from local wallet
      recordPayment(target.amount, target.merchant_name, bankCode, ref);
      setBalance(getWalletBalance());

      // 3. Audio & Haptics
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
        message: 'Pago procesado exitosamente con 1 toque',
      });
      setNearbySession(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al procesar pago');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col justify-between py-10 px-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <Link
          href="/"
          className="text-[14px] text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1"
        >
          ‹ Mi Billetera
        </Link>
        <span className="text-[12px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Pagar al Instante
        </span>
        <div className="w-12" />
      </div>

      {/* Main Content Area */}
      <div className="py-2 space-y-6 animate-fadeIn">
        {/* User Balance Glance */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/[0.06] shadow-apple-sm">
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
              {user?.name || 'Usuario'}
            </span>
            <span className="text-[11px] text-[#86868b] uppercase">
              {user?.default_bank?.toUpperCase() || 'BANESCO'}
            </span>
          </div>
        </div>

        {/* STATE 1: NEARBY CHARGE DETECTED (Apple Pay Style Hero Card) */}
        {nearbySession && !paidResult && (
          <div className="p-6 rounded-3xl bg-white border border-black/[0.08] shadow-apple-card space-y-5 text-center animate-apple-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#34c759]/10 text-[#34c759] text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
              Cobro Cercano Detectado
            </div>

            <div className="space-y-1">
              <span className="text-[13px] text-[#86868b] block">Comercio / Cobrador</span>
              <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
                {nearbySession.merchant_name}
              </h2>
              <div className="text-4xl font-bold font-mono text-[#1d1d1f] pt-2">
                Bs. {nearbySession.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* 1-Touch Big Action Button */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => executePayment()}
              className="w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-semibold text-[16px] hover:bg-black active:scale-[0.98] transition-all shadow-[0_4px_14px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando Pago...
                </>
              ) : (
                'PAGAR CON 1 TOQUE'
              )}
            </button>

            <button
              type="button"
              onClick={() => setNearbySession(null)}
              className="text-[12px] text-[#86868b] hover:text-[#1d1d1f]"
            >
              Ignorar este cobro
            </button>
          </div>
        )}

        {/* STATE 2: SCANNER & RADAR MODE (When no charge locked yet) */}
        {!nearbySession && !paidResult && (
          <div className="space-y-6 text-center">
            {cameraActive ? (
              <div className="relative rounded-3xl overflow-hidden bg-black aspect-square max-w-xs mx-auto shadow-apple-card">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Reticle Overlay */}
                <div className="absolute inset-0 border-2 border-white/30 rounded-3xl pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/80 rounded-2xl animate-pulse" />
                </div>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[12px] font-medium"
                >
                  Cerrar Cámara
                </button>
              </div>
            ) : (
              <div className="py-6 space-y-6">
                {/* Radar Searching Animation */}
                <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-[#0071e3]/5 animate-ping duration-1000" />
                  <div className="absolute inset-4 rounded-full bg-[#0071e3]/10 animate-apple-pulse" />
                  <div className="relative w-28 h-28 rounded-full bg-white border border-black/[0.06] shadow-apple-card flex flex-col items-center justify-center gap-1.5">
                    <svg
                      className="w-8 h-8 text-[#0071e3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-[11px] font-medium text-[#86868b]">
                      Buscando Cobro
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-[#1d1d1f]">
                    Acerca tu celular al cobrador
                  </h3>
                  <p className="text-[13px] text-[#86868b] max-w-xs mx-auto">
                    Apunta la cámara al teléfono que cobra, o espera que aparezca en el radar.
                  </p>
                </div>

                {cameraError && (
                  <p className="text-[12px] text-red-500">{cameraError}</p>
                )}

                <div className="space-y-3 max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-4 rounded-2xl bg-[#1d1d1f] text-white font-semibold text-[15px] hover:bg-black active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Abrir Escáner de Cámara
                  </button>

                  {/* Auto-pay switch toggle */}
                  <label className="flex items-center justify-center gap-2 text-[12px] text-[#86868b] cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={autoPayEnabled}
                      onChange={(e) => setAutoPayEnabled(e.target.checked)}
                      className="accent-[#1d1d1f] w-4 h-4 rounded"
                    />
                    <span>Pagar automáticamente al detectar</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATE 3: PAYMENT CONFIRMED */}
        {paidResult && (
          <div className="space-y-6 text-center animate-fadeIn py-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#34c759]/10 border border-[#34c759]/20 flex items-center justify-center text-[#34c759] shadow-sm">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-1">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#34c759]">
                ¡Pago Exitoso!
              </span>
              <div className="text-4xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
                Bs. {paidResult.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[14px] text-[#86868b]">Pagado a {paidResult.merchant_name}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-black/[0.06] space-y-3 text-left text-[14px] shadow-apple-sm">
              <div className="flex justify-between">
                <span className="text-[#86868b]">Referencia C2P</span>
                <span className="font-mono text-[#1d1d1f] font-semibold">{paidResult.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Nuevo Saldo</span>
                <span className="font-mono text-[#1d1d1f] font-semibold">
                  Bs. {balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#86868b]">Hora</span>
                <span className="text-[#1d1d1f]">{new Date(paidResult.timestamp).toLocaleTimeString('es-VE')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Receipt result={paidResult} />
              <button
                type="button"
                onClick={() => setPaidResult(null)}
                className="w-full py-3.5 rounded-2xl border border-black/[0.08] text-[14px] font-medium text-[#1d1d1f] hover:bg-black/[0.02] transition-colors"
              >
                Hacer otro pago
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-4">
        <span className="text-[11px] text-[#aeaeb2] tracking-[0.08em] uppercase">
          Fiscus Tap · Pago Móvil Inmediato
        </span>
      </div>
    </main>
  );
}
