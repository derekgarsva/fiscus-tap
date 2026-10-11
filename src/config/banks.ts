import { BankConfig } from '@/types';

export const SUPPORTED_BANKS: BankConfig[] = [
  {
    code: 'bdv',
    name: 'Banco de Venezuela',
    short_name: 'BDV',
    color: '#004B87',
    text_color: '#FFFFFF',
    icon: '🏦',
    enabled: true,
  },
  {
    code: 'banesco',
    name: 'Banesco',
    short_name: 'Banesco',
    color: '#00A651',
    text_color: '#FFFFFF',
    icon: '🏦',
    enabled: true,
  },
  {
    code: 'mercantil',
    name: 'Mercantil',
    short_name: 'Mercantil',
    color: '#003DA5',
    text_color: '#FFFFFF',
    icon: '🏦',
    enabled: true,
  },
  {
    code: 'provincial',
    name: 'BBVA Provincial',
    short_name: 'Provincial',
    color: '#004481',
    text_color: '#FFFFFF',
    icon: '🏦',
    enabled: true,
  },
];

export function getBankByCode(code: string): BankConfig | undefined {
  return SUPPORTED_BANKS.find((b) => b.code === code);
}

export function getEnabledBanks(): BankConfig[] {
  return SUPPORTED_BANKS.filter((b) => b.enabled);
}
