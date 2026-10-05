import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

export const currenciesQueryKey = ['currencies'] as const;

// `missing` lists currencies without an exchange rate.
export function useConversion(baseCurrency: string) {
  const { data: accountCurrencies = {} } = useQuery({
    queryKey: [...currenciesQueryKey, 'accounts'],
    queryFn: () => send('account-currencies-get'),
  });

  const used = [
    ...new Set(
      Object.values(accountCurrencies).filter(code => code !== baseCurrency),
    ),
  ].sort();

  const { data: rates = {} } = useQuery({
    queryKey: [...currenciesQueryKey, 'rates', baseCurrency, used.join(',')],
    queryFn: () =>
      send('fx-rates-get', { base: baseCurrency, currencies: used }),
    enabled: used.length > 0,
  });

  function currencyOf(accountId: string): string {
    return accountCurrencies[accountId] ?? baseCurrency;
  }

  function toBase(accountId: string, amount: number): number | null {
    const currency = currencyOf(accountId);
    if (currency === baseCurrency) {
      return amount;
    }
    const rate = rates[currency];
    return rate == null ? null : amount * rate;
  }

  return {
    accountCurrencies,
    rates,
    used,
    currencyOf,
    toBase,
    missing: used.filter(code => rates[code] == null),
  };
}
