'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PaymentResult } from '@/types';
import { getBankByCode } from '@/config/banks';
import { tactileSpring } from '@/lib/motion-config';

interface ReceiptProps {
  result: PaymentResult;
}

export function Receipt({ result }: ReceiptProps) {
  const [copied, setCopied] = useState(false);
  const bank = getBankByCode(result.bank_code);
  const formattedAmount = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(result.amount);

  const date = new Date(result.timestamp);
  const formattedDate = date.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const receiptText = `*COMPROBANTE DE PAGO - FISCUS TAP*\n\n` +
    `🏪 *Comercio:* ${result.merchant_name || 'Comercio Fiscus'}\n` +
    `💰 *Monto:* Bs. ${formattedAmount}\n` +
    `🏦 *Banco:* ${bank?.name || 'Pago Móvil / Tarjeta Contactless'}\n` +
    `🔢 *Referencia:* ${result.reference || 'FT-REF-01'}\n` +
    `📅 *Fecha:* ${formattedDate} ${formattedTime}\n` +
    `⚡ *Canal:* Fiscus Tap NFC (1 Toque)\n\n` +
    `_Comprobante verificado con éxito._`;

  function handleShareWhatsApp() {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(receiptText)}`, '_blank');
  }

  function handleShareGeneral() {
    if (navigator.share) {
      navigator
        .share({
          title: 'Recibo de pago – Fiscus Tap',
          text: receiptText,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(receiptText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div className="space-y-2">
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={tactileSpring}
        type="button"
        onClick={handleShareWhatsApp}
        className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-[14px] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
        <span>Compartir por WhatsApp</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={tactileSpring}
        type="button"
        onClick={handleShareGeneral}
        className="w-full py-3 rounded-2xl bg-white border border-black/[0.06] text-[#1d1d1f] hover:bg-black/[0.02] transition-all flex items-center justify-center gap-2 text-[13px] font-medium shadow-sm cursor-pointer"
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
        <span>{copied ? '¡Copiado al portapapeles!' : 'Copiar / Más opciones'}</span>
      </motion.button>
    </div>
  );
}
