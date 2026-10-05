import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import type { MonthTotal } from './queries';

type MonthlyChartProps = {
  months: MonthTotal[];
  money: (cents: number) => string;
};

export function MonthlyChart({ months, money }: MonthlyChartProps) {
  const { t } = useTranslation();
  const shown = months.slice(-12);
  const biggest = Math.max(
    ...shown.flatMap(month => [month.income, month.expenses]),
    1,
  );

  return (
    <Section title={t('Income and expenses by month')}>
      {shown.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>No transactions in this period.</Trans>
          </Text>
        </View>
      ) : (
        <View style={{ ...rowStyle, display: 'block' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              height: 140,
            }}
          >
            {shown.map(month => (
              <View
                key={month.month}
                style={{
                  flex: '1 1 0',
                  maxWidth: 80,
                  flexDirection: 'row',
                  gap: 2,
                  height: '100%',
                  alignItems: 'flex-end',
                }}
              >
                <View
                  title={`${month.month}: ${money(month.income)}`}
                  style={{
                    flex: 1,
                    height: `${(month.income / biggest) * 100}%`,
                    backgroundColor: theme.noticeTextLight,
                    borderRadius: '3px 3px 0 0',
                  }}
                />
                <View
                  title={`${month.month}: ${money(month.expenses)}`}
                  style={{
                    flex: 1,
                    height: `${(month.expenses / biggest) * 100}%`,
                    backgroundColor: theme.errorText,
                    borderRadius: '3px 3px 0 0',
                  }}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {shown.map(month => (
              <Text
                key={month.month}
                style={{
                  flex: '1 1 0',
                  maxWidth: 80,
                  textAlign: 'center',
                  fontSize: 11,
                  fontFamily: monoFont,
                  color: theme.pageTextSubdued,
                }}
              >
                {month.month.slice(5)}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: theme.noticeTextLight }}>
              ■ <Trans>Income</Trans>
            </Text>
            <Text style={{ fontSize: 12, color: theme.errorText }}>
              ■ <Trans>Expenses</Trans>
            </Text>
          </View>
        </View>
      )}
    </Section>
  );
}
