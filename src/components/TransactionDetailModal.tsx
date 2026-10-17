'use client';

import { useState } from 'react';
import { WalletTransaction } from '@/types';
import { getBankByCode } from '@/config/banks';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: WalletTransaction | null;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !transaction) return null;

  const isPositive = transaction.type === 'deposit' || transaction.type === 'payment_received';
  const bank = transaction.bank_code ? getBankByCode(transaction.bank_code) : null;
  const date = new Date(transaction.timestamp);

  const formattedDate = date.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedAmount = transaction.amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function handleCopyReference() {
    if (!transaction) return;
    navigator.clipboard.writeText(transaction.reference).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShareWhatsApp() {
    if (!transaction) return;
    const text = `*COMPROBANTE DE PAGO - FISCUS TAP*\n\n` +
      `📌 *Operación:* ${transaction.title}\n` +
      `💰 *Monto:* ${isPositive ? '+' : '-'}Bs. ${formattedAmount}\n` +
      `🏦 *Banco/Medio:* ${bank?.name || (transaction.bank_code === 'tarjeta_contactless' ? 'Tarjeta Contactless' : 'Billetera Fiscus')}\n` +
      `🔢 *Referencia:* ${transaction.reference}\n` +
      `📅 *Fecha:* ${formattedDate} ${formattedTime}\n` +
      `🔒 *Canal:* Fiscus Tap NFC (SoftPOS / HCE)\n\n` +
      `_Comprobante verificado electrónicamente._`;

    if (navigator.share) {
      navigator.share({
        title: 'Comprobante Fiscus Tap',
        text,
      }).catch(() => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#fbfbfd] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-[0.08em]">
            Detalle de Transacción
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/[0.05] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.08] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Hero Amount & Icon */}
        <div className="text-center space-y-2">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold ${
              isPositive
                ? 'bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20'
                : 'bg-black/[0.04] text-[#1d1d1f] border border-black/[0.06]'
            }`}
          >
            {isPositive ? '↓' : '↑'}
          </div>

          <div
            className={`text-3xl font-bold font-mono tracking-tight ${
              isPositive ? 'text-[#34c759]' : 'text-[#1d1d1f]'
            }`}
          >
            {isPositive ? '+' : '-'} Bs. {formattedAmount}
          </div>

          <div className="text-[15px] font-medium text-[#1d1d1f]">
            {transaction.title}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34c759]/10 text-[#34c759] text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
            <span>Transacción Exitosa · Acreditada</span>
          </div>
        </div>

        {/* Receipt Details Card */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-3 text-[13px] shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[#86868b]">Referencia Bancaria</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-[#1d1d1f]">{transaction.reference}</span>
              <button
                type="button"
                onClick={handleCopyReference}
                className="px-2 py-0.5 rounded-md bg-black/[0.04] hover:bg-black/[0.08] text-[11px] font-medium text-[#0071e3] transition-colors cursor-pointer"
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Banco / Origen</span>
            <span className="text-[#1d1d1f] font-medium">
              {bank?.name || (transaction.bank_code === 'tarjeta_contactless' ? 'Tarjeta Contactless' : 'Billetera Fiscus')}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Tipo de Operación</span>
            <span className="text-[#1d1d1f]">
              {transaction.type === 'deposit' && 'Recarga de Saldo (C2P)'}
              {transaction.type === 'withdrawal' && 'Retiro a Cuenta'}
              {transaction.type === 'payment_received' && 'Cobro NFC Contactless'}
              {transaction.type === 'payment_sent' && 'Pago Móvil 1 Toque'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Canal Tecnológico</span>
            <span className="text-[#1d1d1f]">
              {transaction.bank_code === 'tarjeta_contactless'
                ? 'NFC SoftPOS (ISO 14443-A/B / EMV)'
                : 'NFC HCE Directo (ISO 7816-4)'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Fecha</span>
            <span className="text-[#1d1d1f]">{formattedDate}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Hora</span>
            <span className="text-[#1d1d1f]">{formattedTime}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-semibold text-[14px] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            <span>Compartir por WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl border border-black/[0.08] text-[13px] font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.02] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
