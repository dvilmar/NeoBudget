import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { View } from '@actual-app/components/view';
import { currentDay } from '@actual-app/core/shared/months';
import { useQuery } from '@tanstack/react-query';

import { formatMoney } from '#components/investments/format';
import { Page } from '#components/Page';
import { useLanguage } from '#hooks/useLocale';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { Breakdown } from './Breakdown';
import { MonthlyChart } from './MonthlyChart';
import { getBreakdown, getMonthly, rangeDates } from './queries';
import type { GroupBy, Kind, Range } from './queries';
import { SavingsRate } from './SavingsRate';
import { YearComparison } from './YearComparison';

export function Insights() {
  const { t } = useTranslation();
  const language = useLanguage();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const currency = defaultCurrencyCode || 'EUR';

  const [range, setRange] = useState<Range>('month');
  const [kind, setKind] = useState<Kind>('expenses');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [offset, setOffset] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: rows = [] } = useQuery({
    queryKey: ['insights', 'breakdown', range, offset, kind, groupBy],
    queryFn: () => getBreakdown(range, offset, kind, groupBy),
  });
  const { data: months = [] } = useQuery({
    queryKey: ['insights', 'monthly', range, offset],
    queryFn: () => getMonthly(range, offset),
  });

  // The comparison is for the selected month, or the current one when
  // the range spans several months
  const selectedMonth = (
    range === 'month' || range === 'lastMonth'
      ? rangeDates(range, offset).start
      : currentDay()
  ).slice(0, 7);

  const money = (cents: number) => formatMoney(cents / 100, currency, language);

  return (
    <Page header={t('Insights')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {(
            [
              ['month', t('This month')],
              ['lastMonth', t('Last month')],
              ['year', t('This year')],
              ['lastYear', t('Last year')],
              ['all', t('All time')],
            ] as [Range, string][]
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={range === value ? 'primary' : 'normal'}
              onPress={() => {
                setRange(value);
                setOffset(0);
              }}
            >
              {label}
            </Button>
          ))}
          <Input
            type="date"
            value={from}
            onChangeValue={setFrom}
            style={{ width: 150 }}
          />
          <Input
            type="date"
            value={to}
            onChangeValue={setTo}
            style={{ width: 150 }}
          />
          <Button
            variant={range.startsWith('custom:') ? 'primary' : 'normal'}
            isDisabled={from === '' || to === '' || from > to}
            onPress={() => setRange(`custom:${from}:${to}`)}
          >
            <Trans>Custom range</Trans>
          </Button>
          <View style={{ flex: 1 }} />
          <Select
            value={kind}
            onChange={setKind}
            options={[
              ['expenses', t('Expenses')],
              ['income', t('Income')],
            ]}
          />
          <Select
            value={groupBy}
            onChange={setGroupBy}
            options={[
              ['category', t('By category')],
              ['payee', t('By payee')],
              ['account', t('By account')],
            ]}
          />
        </View>

        <MonthlyChart months={months} money={money} />
        <SavingsRate months={months} money={money} />
        <YearComparison month={selectedMonth} kind={kind} money={money} />
        <Breakdown
          title={
            kind === 'expenses'
              ? t('Where the money went')
              : t('Where the money came from')
          }
          rows={rows}
          money={money}
        />
      </View>
    </Page>
  );
}
