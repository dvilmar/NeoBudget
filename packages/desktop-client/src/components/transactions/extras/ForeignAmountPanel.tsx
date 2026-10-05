import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { parseDecimal, toErrorMessage } from '#components/investments/format';
import { FormField } from '#components/investments/FormField';
import { useSyncedPref } from '#hooks/useSyncedPref';

type ForeignAmountPanelProps = {
  transactionId: string;
  // Sign of the transaction: negative for money out
  sign: 1 | -1;
};

export function ForeignAmountPanel({
  transactionId,
  sign,
}: ForeignAmountPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['tx-fx', transactionId];

  const { data: fx } = useQuery({
    queryKey,
    queryFn: () => send('tx-fx-get', { transactionId }),
  });
  const [currency, setCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const baseCurrency = defaultCurrencyCode || 'EUR';

  const value = parseDecimal(amount);
  const canSave = currency.trim().length >= 3 && value != null && value > 0;

  async function onSave() {
    if (value == null) {
      return;
    }
    try {
      await send('tx-fx-set', {
        transactionId,
        currency,
        amount: sign * Math.round(value * 100),
      });
      setCurrency('');
      setAmount('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['tx-extras-summary'] });
    } catch (failure) {
      setError(toErrorMessage(failure));
    }
  }

  async function onSuggest() {
    const suggestion = await send('tx-fx-suggest', {
      transactionId,
      currency,
      baseCurrency,
    });
    if (suggestion) {
      setAmount((suggestion.amount / 100).toFixed(2));
      setError(null);
    } else {
      setError(t('There is no exchange rate stored for that day yet.'));
    }
  }

  async function onClear() {
    await send('tx-fx-clear', { transactionId });
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ['tx-extras-summary'] });
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.pageTextSubdued }}>
        <Trans>
          What this transaction was in another currency. The exchange rate is
          worked out from the amount of the transaction.
        </Trans>
      </Text>
      {fx && (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Text>
            {(Math.abs(fx.amount) / 100).toFixed(2)} {fx.currency}
            {fx.rate != null && ` (1 ${fx.currency} = ${fx.rate.toFixed(4)})`}
          </Text>
          <Button variant="bare" onPress={onClear}>
            <Trans>Remove</Trans>
          </Button>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
        <FormField label={t('Currency')} width={90}>
          <Input
            value={currency}
            onChangeValue={setCurrency}
            placeholder="USD"
          />
        </FormField>
        <FormField label={t('Amount')} width={120}>
          <Input value={amount} onChangeValue={setAmount} placeholder="100" />
        </FormField>
        <Button isDisabled={currency.trim().length < 3} onPress={onSuggest}>
          <Trans>Use rate of the day</Trans>
        </Button>
        <Button variant="primary" isDisabled={!canSave} onPress={onSave}>
          <Trans>Save</Trans>
        </Button>
      </View>
      {error && <Text style={{ color: theme.errorText }}>{error}</Text>}
    </View>
  );
}
