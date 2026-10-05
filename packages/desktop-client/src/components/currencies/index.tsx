import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQueryClient } from '@tanstack/react-query';

import { toErrorMessage } from '#components/investments/format';
import { Section } from '#components/overview/Section';
import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

import { AccountCurrencyRow } from './AccountCurrencyRow';
import { RateRow } from './RateRow';
import { currenciesQueryKey, useConversion } from './useConversion';

export function Currencies() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const baseCurrency = defaultCurrencyCode || 'EUR';
  const hasServer = useSyncServerStatus() !== 'no-server';

  const { data: accounts = [] } = useAccounts();
  const { used, rates, currencyOf } = useConversion(baseCurrency);
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function reload() {
    setMessage(null);
    void queryClient.invalidateQueries({ queryKey: currenciesQueryKey });
  }

  async function onRefresh() {
    setIsRefreshing(true);
    try {
      const result = await send('investment-prices-refresh');
      const failure = result.errors.find(error => error.symbol == null);
      setMessage(failure ? failure.message : null);
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setIsRefreshing(false);
      void queryClient.invalidateQueries({ queryKey: currenciesQueryKey });
    }
  }

  return (
    <Page header={t('Currencies')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>
            Each account can have its own currency. Totals are converted to the
            budget currency ({{ base: baseCurrency }}). Budget accounts should
            keep the budget currency; use other currencies for accounts outside
            the budget.
          </Trans>
        </Text>

        {message && <Text style={{ color: theme.errorText }}>{message}</Text>}

        <Section title={t('Accounts')}>
          {accounts
            .filter(account => !account.closed)
            .map(account => (
              <AccountCurrencyRow
                key={account.id}
                name={account.name}
                accountId={account.id}
                currency={currencyOf(account.id)}
                baseCurrency={baseCurrency}
                onChanged={reload}
                onError={setMessage}
              />
            ))}
        </Section>

        {used.length > 0 && (
          <View style={{ gap: 10, flexShrink: 0 }}>
            <View style={{ flexDirection: 'row', flexShrink: 0 }}>
              <Button
                isDisabled={!hasServer || isRefreshing}
                onPress={onRefresh}
              >
                {isRefreshing ? (
                  <Trans>Updating rates…</Trans>
                ) : (
                  <Trans>Update rates</Trans>
                )}
              </Button>
            </View>
            {!hasServer && (
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>
                  Rates download automatically only with a sync server. Without
                  one, set them by hand.
                </Trans>
              </Text>
            )}
            <Section title={t('Exchange rates')}>
              {used.map(currency => (
                <RateRow
                  key={currency}
                  currency={currency}
                  baseCurrency={baseCurrency}
                  rate={rates[currency] ?? null}
                  onChanged={reload}
                  onError={setMessage}
                />
              ))}
            </Section>
          </View>
        )}
      </View>
    </Page>
  );
}
