'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { appleSpring, tactileSpring } from '@/lib/motion-config';

export default function ApkPortalPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('/fiscus-tap.apk');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fullUrl = `${window.location.origin}/fiscus-tap.apk`;
      setDownloadUrl(fullUrl);

      QRCode.toDataURL(fullUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, []);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <main className="min-h-screen bg-[#000000] text-white flex flex-col justify-between p-6 max-w-lg mx-auto selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-6 pt-2 border-b border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Billetera</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
            APK Portal Oficial
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="py-8 space-y-8 flex-1 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={appleSpring}
            className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-0.5 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
          >
            <div className="w-full h-full bg-[#0a0a0c] rounded-[22px] flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1523-.5676.416.416 0 00-.5676.1523l-2.0223 3.503C15.5902 8.4126 13.8533 8.125 12 8.125s-3.5902.2876-5.1366.8249L4.8411 5.4469a.416.416 0 00-.5676-.1523.416.416 0 00-.1523.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.875h24c-.3432-4.2161-2.6889-7.6883-6.1185-9.5536" />
              </svg>
            </div>
          </motion.div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Fiscus <span className="text-emerald-400">Tap</span> para Android
          </h1>
          <p className="text-sm text-white/60 max-w-sm mx-auto">
            Versión nativa con transferencia NFC teléfono a teléfono (HCE), animaciones fluidas a 60fps y sin comisiones.
          </p>
        </div>

        {/* Primary Download Button */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={tactileSpring}
          className="space-y-2"
        >
          <a
            href="/fiscus-tap.apk"
            download="fiscus-tap.apk"
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-lg shadow-[0_10px_30px_rgba(16,185,129,0.35)] flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar APK Oficial (4.5 MB)
          </a>
          <div className="flex items-center justify-between px-2 text-[11px] text-white/40">
            <span>v1.0.0 Release (Build 2026)</span>
            <span>Android 8.0+ / HCE Ready</span>
          </div>
        </motion.div>

        {/* QR Code Section (Scan with phone) */}
        <div className="bg-[#121215] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Escanea para Descargar en tu Móvil
            </h2>
            <p className="text-xs text-white/50">
              Apunta la cámara de tu teléfono Android a este código para iniciar la descarga instantánea.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-2xl shadow-inner">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR para descargar APK de Fiscus Tap"
                  className="w-48 h-48 rounded-lg block"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-black/40 text-xs">
                  Generando código QR...
                </div>
              )}
            </div>
          </div>

          {/* Direct Link Copy Button */}
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 py-2 px-4 rounded-xl transition-all border border-emerald-500/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {copied ? '¡Enlace copiado al portapapeles!' : 'Copiar enlace de descarga directa'}
          </button>
        </div>

        {/* Installation Steps */}
        <div className="bg-[#121215]/60 border border-white/5 rounded-3xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/70">
            Instrucciones de instalación (3 pasos rápidos)
          </h3>
          <ol className="text-xs text-white/60 space-y-2 list-decimal list-inside">
            <li>
              Toca el botón <strong className="text-white">Descargar APK</strong> o escanea el código QR desde tu celular.
            </li>
            <li>
              Si Chrome muestra el aviso <span className="text-amber-400 italic">"Es posible que el archivo sea dañino"</span>, presiona <strong className="text-white">Descargar de todos modos</strong> (es la alerta normal de Android para apps fuera de Google Play).
            </li>
            <li>
              Abre el archivo descargado, presiona <strong className="text-white">Instalar</strong> y ¡listo! Asegúrate de tener el NFC activado en los ajustes de tu teléfono.
            </li>
          </ol>
        </div>

        {/* Technical Specs Card */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-white/40 block text-[10px] uppercase">Arquitectura</span>
            <span className="font-semibold text-white/90">Universal (ARM64 / v7a)</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="text-white/40 block text-[10px] uppercase">Protocolo NFC</span>
            <span className="font-semibold text-white/90">ISO 7816-4 / AID F046495343555301</span>
          </div>
        </div>

        {/* iOS Notice */}
        <div className="text-center pt-2">
          <p className="text-xs text-white/40">
            ¿Usas iPhone?{' '}
            <Link href="/" className="text-emerald-400 underline hover:text-emerald-300">
              Abre Fiscus Tap en Safari y agrégalo a la pantalla de inicio
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-4 pb-2 text-center border-t border-white/10 text-xs text-white/40">
        ⚡ Fiscus Tap · Sistema de Pago Físico NFC de Próxima Generación
      </footer>
    </main>
  );
}
