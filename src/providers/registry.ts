import { PaymentProviderInterface } from '@/types';
import { BDVProvider } from './bdv';
import { BanescoProvider } from './banesco';
import { MercantilProvider } from './mercantil';
import { ProvincialProvider } from './provincial';

const providers = new Map<string, PaymentProviderInterface>();

function registerDefaults(): void {
  if (providers.size > 0) return;
  const defaults: PaymentProviderInterface[] = [
    new BDVProvider(),
    new BanescoProvider(),
    new MercantilProvider(),
    new ProvincialProvider(),
  ];
  defaults.forEach((p) => providers.set(p.code, p));
}

export function getProvider(
  code: string
): PaymentProviderInterface | undefined {
  registerDefaults();
  return providers.get(code);
}

export function registerProvider(
  provider: PaymentProviderInterface
): void {
  providers.set(provider.code, provider);
}

export function getAllProviders(): PaymentProviderInterface[] {
  registerDefaults();
  return Array.from(providers.values());
}
