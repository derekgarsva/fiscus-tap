'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  url: string;
  amount: number;
}

export function QRCodeDisplay({ url, amount }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1d1d1f',
        light: '#ffffff',
      },
    })
      .then((res) => setDataUrl(res))
      .catch((err) => console.error('Error generating local QR:', err));
  }, [url]);

  return (
    <div className="p-6 bg-white rounded-3xl border border-black/[0.06] shadow-apple-card space-y-4 text-center animate-fadeIn">
      <div className="space-y-1">
        <span className="text-[12px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Escanea para pagar al instante
        </span>
        <div className="text-2xl font-bold font-mono text-[#1d1d1f]">
          Bs. {amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="w-60 h-60 mx-auto bg-white p-3 rounded-2xl border border-black/[0.06] shadow-sm flex items-center justify-center">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`Código QR para cobrar Bs. ${amount}`}
            className="w-full h-full object-contain rounded-lg"
            loading="eager"
          />
        ) : (
          <div className="w-8 h-8 border-2 border-[#1d1d1f] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <p className="text-[12px] text-[#86868b] leading-tight">
        Apunta con la cámara de tu iPhone para pagar con 1 toque
      </p>
    </div>
  );
}
