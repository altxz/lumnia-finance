import { useQuery } from '@tanstack/react-query';

export interface ExchangeRates {
  USD: number;
  EUR: number;
  BTC: number;
}

async function fetchRates(): Promise<ExchangeRates> {
  const [fiatRes, btcRes] = await Promise.all([
    fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL'),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl'),
  ]);

  const fiat = await fiatRes.json();
  const btc = await btcRes.json();

  return {
    USD: parseFloat(fiat?.USDBRL?.bid ?? '0'),
    EUR: parseFloat(fiat?.EURBRL?.bid ?? '0'),
    BTC: btc?.bitcoin?.brl ?? 0,
  };
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchRates,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchInterval: 5 * 60 * 1000,
  });
}

export function convertToBRL(amount: number, currency: string, rates: ExchangeRates | undefined): number | null {
  if (!rates || currency === 'BRL') return null;
  const rate = rates[currency as keyof ExchangeRates];
  if (!rate) return null;
  return amount * rate;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  BRL: 'R$',
  USD: '$',
  EUR: '€',
  BTC: '₿',
};

export function formatForeignCurrency(value: number, currency: string): string {
  if (currency === 'BTC') {
    return `₿ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
  }
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
