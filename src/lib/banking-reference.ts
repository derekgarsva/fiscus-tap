/**
 * Venezuelan Banking Reference Generator (SUDEBAN C2P Compliance)
 *
 * Generates formatted, verifiable banking references:
 * Format: FT-{BANK_PREFIX}-{YYMMDD}-{HEX_TOKEN}-{CHECKSUM}
 * Example: FT-0134-261012-A3F9B2-45
 *
 * 100% Pure JavaScript implementation: zero native node scheme dependencies,
 * compatible across Webpack, Next.js client bundles, Capacitor mobile, and Node.js.
 */

export interface BankReferenceOptions {
  bankCode?: string;
  sessionId?: string;
  payerPhone?: string;
  amount?: number;
}

export const BANK_PREFIX_MAP: Record<string, string> = {
  bdv: '0102',
  banesco: '0134',
  mercantil: '0105',
  provincial: '0108',
  'mock-c2p': '0199',
};

/**
 * Deterministic FNV-1a 32-bit hash producing a 6-character uppercase hex token.
 */
function deterministicHexToken(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(6, '0').slice(-6).toUpperCase();
}

/**
 * Generates a standard Venezuelan C2P reference:
 * FT-{BANK_PREFIX}-{YYMMDD}-{HEX_TOKEN}-{CHECKSUM}
 */
export function generateBankingReference(options: BankReferenceOptions = {}): string {
  const bankCode = (options.bankCode || 'banesco').toLowerCase();
  const bankPrefix = BANK_PREFIX_MAP[bankCode] || '0134';

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  const sessionId = options.sessionId || `s_${Date.now()}`;
  const payerPhone = options.payerPhone || '04140000000';
  const amountStr = typeof options.amount === 'number' ? options.amount.toFixed(2) : '0.00';

  const seed = `${sessionId}:${payerPhone}:${amountStr}`;
  const hexToken = deterministicHexToken(seed);

  // 2-digit modulo checksum
  const tokenNum = parseInt(hexToken, 16) || 0;
  const prefixNum = parseInt(bankPrefix, 10) || 0;
  const sum = (tokenNum + prefixNum) % 100;
  const checkStr = String(Math.abs(sum)).padStart(2, '0');

  return `FT-${bankPrefix}-${dateStr}-${hexToken}-${checkStr}`;
}

/**
 * Validates whether a reference string matches the standard SUDEBAN C2P pattern:
 * FT-\d{4}-\d{6}-[A-F0-9]{6}-\d{2}
 */
export function isValidBankingReference(ref: string): boolean {
  if (!ref || typeof ref !== 'string') return false;
  const pattern = /^FT-\d{4}-\d{6}-[A-F0-9]{6}-\d{2}$/;
  return pattern.test(ref);
}
