'use client';

interface QRCodeDisplayProps {
  url: string;
  amount: number;
}

export function QRCodeDisplay({ url, amount }: QRCodeDisplayProps) {
  const qrEndpoint = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&format=svg&data=${encodeURIComponent(
    url
  )}`;

  return (
    <div className="p-6 bg-white rounded-3xl border border-black/[0.06] shadow-apple-card space-y-4 text-center animate-fadeIn">
      <div className="space-y-1">
        <span className="text-[12px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
          Escanea para pagar
        </span>
        <div className="text-xl font-bold font-mono text-[#1d1d1f]">
          Bs. {amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border border-black/[0.06] shadow-sm flex items-center justify-center">
        <img
          src={qrEndpoint}
          alt={`Código QR para cobrar Bs. ${amount}`}
          className="w-full h-full object-contain rounded-lg"
          loading="eager"
        />
      </div>

      <p className="text-[12px] text-[#86868b] leading-tight">
        Apunta con la cámara de cualquier teléfono para abrir Fiscus Tap directamente
      </p>
    </div>
  );
}
