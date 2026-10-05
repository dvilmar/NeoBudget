import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { toErrorMessage } from '#components/investments/format';
import { rowStyle } from '#components/overview/rowStyle';

export const COMMON_CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
];

type AccountCurrencyRowProps = {
  name: string;
  accountId: string;
  currency: string;
  baseCurrency: string;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function AccountCurrencyRow({
  name,
  accountId,
  currency,
  baseCurrency,
  onChanged,
  onError,
}: AccountCurrencyRowProps) {
  const options = [...new Set([baseCurrency, currency, ...COMMON_CURRENCIES])];

  async function onChange(next: string) {
    try {
      await send('account-currency-set', {
        accountId,
        currency: next === baseCurrency ? null : next,
      });
      onChanged();
    } catch (error) {
      onError(toErrorMessage(error));
    }
  }

  return (
    <View style={rowStyle}>
      <Text style={{ flex: 1 }}>{name}</Text>
      <Select
        value={currency}
        onChange={onChange}
        options={options.map(code => [code, code])}
      />
    </View>
  );
}
