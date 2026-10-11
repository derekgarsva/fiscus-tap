interface MerchantHeaderProps {
  name: string;
  amount: number;
  currency?: string;
  logoUrl?: string;
}

export function MerchantHeader({
  name,
  amount,
  logoUrl,
}: MerchantHeaderProps) {
  const formattedAmount = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <div className="text-center space-y-4 py-4">
      {/* Merchant avatar / logo */}
      <div className="w-20 h-20 mx-auto bg-white border border-black/[0.06] rounded-3xl flex items-center justify-center text-3xl font-semibold shadow-apple-card text-[#1d1d1f]">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="w-12 h-12 object-contain"
          />
        ) : (
          <span>{name.charAt(0)}</span>
        )}
      </div>

      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.04] text-[12px] font-medium text-[#86868b]">
          <span>Comercio Verificado</span>
          <span className="text-[#34c759]">✓</span>
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.025em] text-[#1d1d1f]">{name}</h1>
      </div>

      {amount > 0 && (
        <div className="pt-2">
          <span className="text-[13px] font-medium tracking-[0.08em] text-[#86868b] uppercase block mb-1">
            Total a Pagar
          </span>
          <div className="text-5xl font-bold tracking-[-0.03em] font-mono text-[#1d1d1f]">
            <span className="text-2xl font-semibold text-[#86868b] mr-1.5">Bs.</span>
            {formattedAmount}
          </div>
        </div>
      )}
    </div>
  );
}
