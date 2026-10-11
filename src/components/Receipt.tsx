'use client';

import { PaymentResult } from '@/types';
import { getBankByCode } from '@/config/banks';

interface ReceiptProps {
  result: PaymentResult;
}

export function Receipt({ result }: ReceiptProps) {
  const bank = getBankByCode(result.bank_code);
  const formattedAmount = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(result.amount);

  const date = new Date(result.timestamp);

  function handleShare() {
    const text = `Recibo Fiscus Tap\nComercio: ${result.merchant_name}\nMonto: Bs. ${formattedAmount}\nBanco: ${bank?.name}\nRef: ${result.reference}\nFecha: ${date.toLocaleString('es-VE')}`;

    if (navigator.share) {
      navigator
        .share({
          title: 'Recibo de pago – Fiscus Tap',
          text,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => alert('Recibo copiado al portapapeles'));
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full py-3.5 rounded-2xl bg-white border border-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.02] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-[14px] font-medium shadow-sm"
    >
      <svg
        className="w-4 h-4 text-[#86868b]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span>Compartir comprobante</span>
    </button>
  );
}
