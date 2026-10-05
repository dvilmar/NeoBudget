import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { currentMonth } from '@actual-app/core/shared/months';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { useQuery } from '@tanstack/react-query';

import { useSyncAndDownloadMutation } from '#accounts';
import { prewarmMonth } from '#components/budget/util';
import { useConversion } from '#components/currencies/useConversion';
import { FinancialText } from '#components/FinancialText';
import { investmentsQueryKey } from '#components/investments';
import { formatMoney, formatPercent } from '#components/investments/format';
import { Page } from '#components/Page';
import { useAccountBalances } from '#hooks/useAccountBalances';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useLanguage } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { aqlQuery } from '#queries/aqlQuery';

import { border } from './border';
import { BudgetRow } from './BudgetRow';
import { LeftPerDayStat } from './LeftPerDayStat';
import { monoFont } from './monoFont';
import { MonthSheet } from './MonthSheet';
import { MonthSwitcher } from './MonthSwitcher';
import { PiggyProgress } from './PiggyProgress';
import { rowStyle } from './rowStyle';
import { Section } from './Section';
import { Sparkline } from './Sparkline';
import { Stat } from './Stat';
import { ToBudgetStat } from './ToBudgetStat';
import { TopSpending } from './TopSpending';
import { UpcomingSchedules } from './UpcomingSchedules';

function gainColor(value: number | null | undefined) {
  if (!value) {
    return theme.pageTextSubdued;
  }
  return value > 0 ? theme.noticeTextLight : theme.errorText;
}

export function Overview() {
  const { t } = useTranslation();
  const language = useLanguage();
  const navigate = useNavigate();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const baseCurrency = defaultCurrencyCode || 'EUR';

  const { data: { list: categories } = { list: [] } } = useCategories();
  const budgetCategories = categories.filter(
    category => !category.is_income && !category.hidden,
  );
  const { data: history = [] } = useQuery({
    queryKey: [...investmentsQueryKey, 'history', baseCurrency],
    queryFn: () => send('investment-value-history', { baseCurrency }),
  });
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [readyMonth, setReadyMonth] = useState<string | null>(null);
  const spreadsheet = useSpreadsheet();

  // The month has to be in the spreadsheet before its cells can be read
  useEffect(() => {
    let isCurrent = true;
    void prewarmMonth('envelope', spreadsheet, selectedMonth).then(() => {
      if (isCurrent) {
        setReadyMonth(selectedMonth);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [selectedMonth, spreadsheet]);

  const conversion = useConversion(baseCurrency);
  const { data: monthByAccount = [] } = useQuery({
    queryKey: ['overview', 'month-change', selectedMonth],
    queryFn: async () => {
      const { data } = await aqlQuery(
        q('transactions')
          .filter({
            date: {
              $gte: monthUtils.firstDayOfMonth(selectedMonth),
              $lte: monthUtils.lastDayOfMonth(selectedMonth),
            },
            'account.closed': false,
          })
          .options({ splits: 'none' })
          .groupBy('account')
          .select(['account', { total: { $sum: '$amount' } }]),
      );
      return (data as { account: string; total: number }[]).map(row => ({
        accountId: row.account,
        total: Number(row.total ?? 0),
      }));
    },
  });
  // Each account is converted with its own currency
  const monthChange = monthByAccount.reduce(
    (sum, row) => sum + (conversion.toBase(row.accountId, row.total) ?? 0),
    0,
  );
  const { data: accounts = [] } = useAccounts();
  const accountNames = new Map(
    accounts.map(account => [account.id, account.name]),
  );
  const { mutate: syncAndDownload, isPending: isSyncing } =
    useSyncAndDownloadMutation();
  const balances = useAccountBalances(accounts.map(account => account.id));
  const { data: positions = [] } = useQuery({
    queryKey: [...investmentsQueryKey, 'positions', baseCurrency],
    queryFn: () => send('investment-positions-get', { baseCurrency }),
  });

  const money = (cents: number | null | undefined) =>
    formatMoney(cents == null ? null : cents / 100, baseCurrency, language);

  const open = accounts.filter(account => !account.closed);
  const sum = (list: typeof open) =>
    list.reduce(
      (total, account) =>
        total + (conversion.toBase(account.id, balances[account.id] ?? 0) ?? 0),
      0,
    );
  const invested = positions.reduce(
    (total, position) => total + (position.base?.marketValue ?? 0),
    0,
  );
  const investedGain = positions.reduce(
    (total, position) => total + (position.base?.unrealizedGain ?? 0),
    0,
  );
  const month = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${selectedMonth}-01T12:00:00`));

  return (
    <Page header={month}>
      <View style={{ gap: 28, paddingBottom: 40, width: '100%' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <MonthSwitcher month={selectedMonth} onChange={setSelectedMonth} />
          <View style={{ width: 16 }} />
          <Button
            style={{ height: 32 }}
            isDisabled={isSyncing}
            onPress={() => syncAndDownload({})}
          >
            <Trans>Sync</Trans>
          </Button>
          <Button
            variant="primary"
            style={{ height: 32 }}
            onPress={() => navigate('/accounts')}
          >
            <Trans>Add transaction</Trans>
          </Button>
        </View>

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
            label={t('Net worth')}
            value={money(sum(open))}
            note={`${monthChange != null && monthChange > 0 ? '+' : ''}${money(monthChange)} ${t('this month')}`}
            noteColor={gainColor(monthChange)}
          />
          <MonthSheet
            month={selectedMonth}
            ready={readyMonth === selectedMonth}
          >
            <ToBudgetStat money={money} />
          </MonthSheet>
          <Stat
            label={t('Investments')}
            value={formatMoney(invested, baseCurrency, language)}
            note={formatMoney(investedGain, baseCurrency, language)}
            noteColor={gainColor(investedGain)}
          >
            <Sparkline values={history.map(point => point.value)} />
          </Stat>
        </View>

        {conversion.missing.length > 0 && (
          <Text style={{ color: theme.errorText, flexShrink: 0 }}>
            <Trans>
              Accounts in {{ currencies: conversion.missing.join(', ') }} are
              left out of the totals: no exchange rate yet.
            </Trans>
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 28,
            flexShrink: 0,
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flex: '1 1 320px', minWidth: 0 }}>
            <MonthSheet
              month={selectedMonth}
              ready={readyMonth === selectedMonth}
            >
              <Section title={t('Left to spend')}>
                <LeftPerDayStat first money={money} month={selectedMonth} />
              </Section>
            </MonthSheet>
          </View>
          <View style={{ flex: '1 1 320px', minWidth: 0 }}>
            <MonthSheet
              month={selectedMonth}
              ready={readyMonth === selectedMonth}
            >
              <UpcomingSchedules money={money} />
            </MonthSheet>
          </View>
          <View style={{ flex: '1 1 320px', minWidth: 0 }}>
            <PiggyProgress money={money} />
          </View>
          <View style={{ flex: '1 1 320px', minWidth: 0 }}>
            <TopSpending money={money} month={selectedMonth} />
          </View>
        </View>

        <Section title={t('Budget')}>
          <View
            style={{ ...rowStyle, color: theme.pageTextSubdued, fontSize: 12 }}
          >
            <Text style={{ flex: 2 }}>
              <Trans>Category</Trans>
            </Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>
              <Trans>Budgeted</Trans>
            </Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>
              <Trans>Spent</Trans>
            </Text>
            <Text style={{ flex: 1, textAlign: 'right' }}>
              <Trans>Available</Trans>
            </Text>
          </View>
          <MonthSheet
            month={selectedMonth}
            ready={readyMonth === selectedMonth}
          >
            {budgetCategories.map(category => (
              <BudgetRow key={category.id} category={category} money={money} />
            ))}
          </MonthSheet>
        </Section>

        <Section title={t('Positions')}>
          {positions.length === 0 ? (
            <View style={rowStyle}>
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>No investments yet.</Trans>
              </Text>
            </View>
          ) : (
            positions.map(position => (
              <View key={position.asset.id} style={rowStyle}>
                <Text style={{ flex: 2 }}>{position.asset.name}</Text>
                <Text style={{ flex: 2, color: theme.pageTextLight }}>
                  {position.accountIds
                    .map(id => accountNames.get(id))
                    .filter(Boolean)
                    .join(', ') || position.asset.symbol}
                </Text>
                <FinancialText
                  style={{ flex: 1, textAlign: 'right', fontFamily: monoFont }}
                >
                  {formatMoney(
                    position.base?.marketValue,
                    baseCurrency,
                    language,
                  )}
                </FinancialText>
                <FinancialText
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontFamily: monoFont,
                    color: gainColor(position.unrealizedGainPercent),
                  }}
                >
                  {formatPercent(position.unrealizedGainPercent, language)}
                </FinancialText>
              </View>
            ))
          )}
        </Section>
      </View>
    </Page>
  );
}
