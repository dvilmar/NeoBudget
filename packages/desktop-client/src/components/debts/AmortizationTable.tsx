import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { amortizationSchedule } from '@actual-app/core/shared/debts';
import type { DebtProgress } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';

type AmortizationTableProps = {
  debt: DebtProgress;
  money: (cents: number) => string;
};

export function AmortizationTable({ debt, money }: AmortizationTableProps) {
  const rows =
    debt.monthly_payment == null
      ? []
      : amortizationSchedule(
          debt.outstanding,
          debt.interest_rate,
          debt.monthly_payment,
        );

  if (rows.length === 0) {
    return (
      <Text style={{ color: theme.pageTextSubdued, padding: '0 25px 16px' }}>
        <Trans>
          Set a monthly payment that covers the interest to see the schedule.
        </Trans>
      </Text>
    );
  }

  const cell = { flex: 1, textAlign: 'right', fontFamily: monoFont } as const;
  const totalInterest = rows.reduce((sum, row) => sum + row.interest, 0);

  return (
    <View style={{ padding: '0 25px 16px' }}>
      <View style={{ ...rowStyle, color: theme.pageTextSubdued, fontSize: 12 }}>
        <Text style={{ width: 40 }}>#</Text>
        <Text style={cell}>
          <Trans>Payment</Trans>
        </Text>
        <Text style={cell}>
          <Trans>Interest</Trans>
        </Text>
        <Text style={cell}>
          <Trans>Principal</Trans>
        </Text>
        <Text style={cell}>
          <Trans>Balance</Trans>
        </Text>
      </View>
      {rows.map(row => (
        <View key={row.number} style={rowStyle}>
          <Text style={{ width: 40 }}>{row.number}</Text>
          <FinancialText style={cell}>{money(row.payment)}</FinancialText>
          <FinancialText style={cell}>{money(row.interest)}</FinancialText>
          <FinancialText style={cell}>{money(row.principal)}</FinancialText>
          <FinancialText style={cell}>{money(row.balance)}</FinancialText>
        </View>
      ))}
      <Text style={{ color: theme.pageTextSubdued, marginTop: 8 }}>
        <Trans>Total interest to pay</Trans>: {money(totalInterest)}
      </Text>
    </View>
  );
}
