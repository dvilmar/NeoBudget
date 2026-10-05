import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { computeFire, emergencyFund } from '@actual-app/core/shared/fire';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { useQuery } from '@tanstack/react-query';

import { useConversion } from '#components/currencies/useConversion';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';
import { useAccountBalances } from '#hooks/useAccountBalances';
import { useAccounts } from '#hooks/useAccounts';
import { aqlQuery } from '#queries/aqlQuery';

import { formatMoney, parseDecimal } from './format';
import { FormField } from './FormField';

type FireProps = {
  baseCurrency: string;
  language: string;
  portfolio: number;
};

export function Fire({ baseCurrency, language, portfolio }: FireProps) {
  const { t } = useTranslation();
  const [returnText, setReturnText] = useState('4');
  const [rateText, setRateText] = useState('4');
  const [monthsText, setMonthsText] = useState('6');

  // Average of the last twelve full months
  const { data: averages } = useQuery({
    queryKey: ['fire', 'averages'],
    queryFn: async () => {
      const end = monthUtils.subMonths(monthUtils.currentMonth(), 1);
      const start = monthUtils.subMonths(end, 11);
      const total = async (isIncome: boolean) => {
        const { data } = await aqlQuery(
          q('transactions')
            .filter({
              date: {
                $gte: monthUtils.firstDayOfMonth(start),
                $lte: monthUtils.lastDayOfMonth(end),
              },
              'category.is_income': isIncome,
              'account.offbudget': false,
            })
            .options({ splits: 'inline' })
            .calculate({ $sum: '$amount' }),
        );
        return Number(data ?? 0) / 100 / 12;
      };
      return { expenses: -(await total(false)), income: await total(true) };
    },
  });

  const { data: accounts = [] } = useAccounts();
  const balances = useAccountBalances(accounts.map(account => account.id));
  const conversion = useConversion(baseCurrency);
  const cash =
    accounts
      .filter(account => !account.closed && !account.offbudget)
      .reduce(
        (sum, account) =>
          sum + (conversion.toBase(account.id, balances[account.id] ?? 0) ?? 0),
        0,
      ) / 100;

  const monthlyExpenses = Math.max(averages?.expenses ?? 0, 0);
  const monthlySavings = (averages?.income ?? 0) - monthlyExpenses;
  const realReturn = parseDecimal(returnText);
  const rate = parseDecimal(rateText);
  const months = parseDecimal(monthsText);

  if (
    !averages ||
    monthlyExpenses === 0 ||
    realReturn == null ||
    rate == null
  ) {
    return (
      <Section title={t('FIRE')}>
        <View style={{ ...rowStyle, gap: 12, flexWrap: 'wrap' }}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Not enough spending history yet to estimate your FIRE number.
            </Trans>
          </Text>
          <FormField label={t('Real return (%)')} width={110}>
            <Input value={returnText} onChangeValue={setReturnText} />
          </FormField>
          <FormField label={t('Withdrawal rate (%)')} width={130}>
            <Input value={rateText} onChangeValue={setRateText} />
          </FormField>
        </View>
      </Section>
    );
  }

  const fire = computeFire({
    annualExpenses: monthlyExpenses * 12,
    portfolio,
    annualSavings: monthlySavings * 12,
    realReturn,
    withdrawalRate: rate,
  });
  const target = emergencyFund(monthlyExpenses, months ?? 0);
  const money = (value: number) => formatMoney(value, baseCurrency, language);

  const line = (label: string, value: string, color?: string) => (
    <View style={rowStyle}>
      <Text style={{ flex: 2 }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          textAlign: 'right',
          fontFamily: monoFont,
          color: color ?? theme.pageText,
        }}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <Section title={t('FIRE')}>
      <View style={{ ...rowStyle, gap: 12, flexWrap: 'wrap' }}>
        <FormField label={t('Real return (%)')} width={110}>
          <Input value={returnText} onChangeValue={setReturnText} />
        </FormField>
        <FormField label={t('Withdrawal rate (%)')} width={130}>
          <Input value={rateText} onChangeValue={setRateText} />
        </FormField>
        <FormField label={t('Emergency fund (months)')} width={150}>
          <Input value={monthsText} onChangeValue={setMonthsText} />
        </FormField>
      </View>
      {line(t('Average monthly spending'), money(monthlyExpenses))}
      {line(t('Average monthly savings'), money(monthlySavings))}
      {line(t('FIRE number'), money(fire.fireNumber))}
      {line(t('Progress'), `${fire.progress.toFixed(1)} %`)}
      {line(
        t('Years to FIRE'),
        fire.yearsToFire == null
          ? t('Not reachable at this pace')
          : String(fire.yearsToFire),
      )}
      {line(
        t('Emergency fund'),
        `${money(Math.max(cash, 0))} / ${money(target)}`,
        cash >= target ? theme.noticeTextLight : theme.errorText,
      )}
    </Section>
  );
}
