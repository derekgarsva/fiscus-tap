import { PaymentResult } from '@/types';
import { getBankByCode } from '@/config/banks';

interface PaymentConfirmationProps {
  result: PaymentResult;
  onNewPayment: () => void;
}

export function PaymentConfirmation({
  result,
  onNewPayment,
}: PaymentConfirmationProps) {
  const bank = getBankByCode(result.bank_code);
  const formattedAmount = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(result.amount);

  const date = new Date(result.timestamp);
  const formattedDate = date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (result.success) {
    return (
      <div className="space-y-6 text-center py-4 animate-fadeIn">
        {/* Apple Style Checkmark */}
        <div className="w-20 h-20 mx-auto bg-[#34c759]/10 border border-[#34c759]/25 rounded-full flex items-center justify-center text-[#34c759] shadow-sm">
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
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-[#1d1d1f]">
            Pago Confirmado
          </h2>
          <p className="text-[#86868b] text-[14px]">
            {result.message}
          </p>
        </div>

        {/* Clean Receipt Card */}
        <div className="bg-white rounded-3xl p-6 space-y-4 text-left border border-black/[0.06] shadow-apple-card text-[14px]">
          <div className="flex justify-between items-center pb-3 border-b border-black/[0.04]">
            <span className="text-[#86868b]">Monto pagado</span>
            <span className="text-2xl font-bold font-mono text-[#1d1d1f]">
              Bs. {formattedAmount}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Comercio</span>
            <span className="text-[#1d1d1f] font-semibold">
              {result.merchant_name}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Banco emisor</span>
            <span className="text-[#1d1d1f] font-medium">
              {bank?.name || 'Banesco'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Referencia C2P</span>
            <span className="text-[#1d1d1f] font-mono font-medium">
              {result.reference}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#86868b]">Fecha y hora</span>
            <span className="text-[#1d1d1f]">
              {formattedDate} · {formattedTime}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewPayment}
          className="w-full py-4 rounded-2xl font-semibold text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all shadow-apple-card"
        >
          Listo
        </button>
      </div>
    );
  }

  // Error state
  return (
    <div className="space-y-6 text-center py-4 animate-fadeIn">
      <div className="w-20 h-20 mx-auto bg-[#ff3b30]/10 border border-[#ff3b30]/25 rounded-full flex items-center justify-center text-[#ff3b30] shadow-sm">
        <svg
          className="w-10 h-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-[-0.025em] text-[#1d1d1f]">
          No se pudo procesar
        </h2>
        <p className="text-[#86868b] text-[14px]">
          {result.message}
        </p>
      </div>

      <button
        type="button"
        onClick={onNewPayment}
        className="w-full py-4 rounded-2xl font-medium text-[16px] bg-[#1d1d1f] text-white hover:bg-black active:scale-[0.99] transition-all shadow-sm"
      >
        Intentar nuevamente
      </button>
    </div>
  );
}
