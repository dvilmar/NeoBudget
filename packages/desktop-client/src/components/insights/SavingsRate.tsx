import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { cumulativeSavings } from '@actual-app/core/shared/insights';

import { FinancialText } from '#components/FinancialText';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import type { MonthTotal } from './queries';

type SavingsRateProps = {
  months: MonthTotal[];
  money: (cents: number) => string;
};

export function SavingsRate({ months, money }: SavingsRateProps) {
  const { t } = useTranslation();
  const rows = cumulativeSavings(months).slice(-12);
  const cell = { flex: 1, textAlign: 'right', fontFamily: monoFont } as const;

  if (rows.length === 0) {
    return null;
  }

  return (
    <Section title={t('Cumulative income, expenses and savings rate')}>
      <View style={{ ...rowStyle, color: theme.pageTextSubdued, fontSize: 12 }}>
        <Text style={{ flex: 1 }}>
          <Trans>Month</Trans>
        </Text>
        <Text style={{ ...cell, fontFamily: undefined }}>
          <Trans>Income so far</Trans>
        </Text>
        <Text style={{ ...cell, fontFamily: undefined }}>
          <Trans>Expenses so far</Trans>
        </Text>
        <Text style={{ ...cell, fontFamily: undefined }}>
          <Trans>Savings rate</Trans>
        </Text>
      </View>
      {rows.map(row => (
        <View key={row.month} style={rowStyle}>
          <Text style={{ flex: 1, fontFamily: monoFont }}>{row.month}</Text>
          <FinancialText style={cell}>
            {money(row.cumulativeIncome)}
          </FinancialText>
          <FinancialText style={cell}>
            {money(row.cumulativeExpenses)}
          </FinancialText>
          <FinancialText
            style={{
              ...cell,
              color:
                row.savingsRate != null && row.savingsRate < 0
                  ? theme.errorText
                  : undefined,
            }}
          >
            {row.savingsRate == null
              ? '—'
              : `${(row.savingsRate * 100).toFixed(0)} %`}
          </FinancialText>
        </View>
      ))}
    </Section>
  );
}
