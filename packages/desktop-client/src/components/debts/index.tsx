import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { formatMoney } from '#components/investments/format';
import { border } from '#components/overview/border';
import { Section } from '#components/overview/Section';
import { Stat } from '#components/overview/Stat';
import { Page } from '#components/Page';
import { useLanguage } from '#hooks/useLocale';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { DebtForm } from './DebtForm';
import { DebtRow } from './DebtRow';

export const debtsQueryKey = ['debts'] as const;

export function Debts() {
  const { t } = useTranslation();
  const language = useLanguage();
  const queryClient = useQueryClient();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const currency = defaultCurrencyCode || 'EUR';

  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: debts = [] } = useQuery({
    queryKey: debtsQueryKey,
    queryFn: () => send('debts-get'),
  });

  const money = (cents: number) => formatMoney(cents / 100, currency, language);
  const owedByMe = debts.filter(debt => debt.direction === 'owed_by_me');
  const owedToMe = debts.filter(debt => debt.direction === 'owed_to_me');
  const sum = (list: typeof debts, field: 'outstanding' | 'interestPaid') =>
    list.reduce((total, debt) => total + debt[field], 0);

  function reload() {
    setMessage(null);
    void queryClient.invalidateQueries({ queryKey: debtsQueryKey });
  }

  function renderRows(list: typeof debts) {
    return list.map(debt => (
      <DebtRow
        key={debt.id}
        debt={debt}
        money={money}
        onChanged={reload}
        onError={setMessage}
      />
    ));
  }

  return (
    <Page header={t('Debts')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            flexShrink: 0,
            border,
            borderRadius: 8,
            backgroundColor: theme.cardBackground,
          }}
        >
          <Stat
            first
            label={t('I owe')}
            value={money(sum(owedByMe, 'outstanding'))}
          />
          <Stat
            label={t('I am owed')}
            value={money(sum(owedToMe, 'outstanding'))}
          />
          <Stat
            label={t('Interest paid')}
            value={money(sum(debts, 'interestPaid'))}
          />
        </View>

        <View style={{ flexDirection: 'row', flexShrink: 0 }}>
          <Button variant="primary" onPress={() => setIsAdding(!isAdding)}>
            <Trans>New debt</Trans>
          </Button>
        </View>

        {message && <Text style={{ color: theme.errorText }}>{message}</Text>}
        {isAdding && (
          <DebtForm
            onDone={() => {
              setIsAdding(false);
              reload();
            }}
            onError={setMessage}
          />
        )}

        {debts.length === 0 && (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              No debts yet. Add a loan, a mortgage or money you lent to follow
              what is left to pay.
            </Trans>
          </Text>
        )}
        {owedByMe.length > 0 && (
          <Section title={t('I owe')}>{renderRows(owedByMe)}</Section>
        )}
        {owedToMe.length > 0 && (
          <Section title={t('I am owed')}>{renderRows(owedToMe)}</Section>
        )}
      </View>
    </Page>
  );
}
