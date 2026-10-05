import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { compareCategories } from '@actual-app/core/shared/insights';
import * as monthUtils from '@actual-app/core/shared/months';
import { useQuery } from '@tanstack/react-query';

import { FinancialText } from '#components/FinancialText';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import { getBreakdown } from './queries';
import type { Kind } from './queries';

type YearComparisonProps = {
  // YYYY-MM, the month selected on the page
  month: string;
  kind: Kind;
  money: (cents: number) => string;
};

function monthRange(month: string) {
  return `custom:${monthUtils.firstDayOfMonth(month)}:${monthUtils.lastDayOfMonth(month)}` as const;
}

export function YearComparison({ month, kind, money }: YearComparisonProps) {
  const { t } = useTranslation();
  const previousMonth = monthUtils.subMonths(month, 12);

  const { data: rows = [] } = useQuery({
    queryKey: ['insights', 'year-comparison', month, kind],
    queryFn: async () =>
      compareCategories(
        await getBreakdown(monthRange(month), 0, kind, 'category'),
        await getBreakdown(monthRange(previousMonth), 0, kind, 'category'),
      ),
  });

  const cell = { flex: 1, textAlign: 'right' } as const;

  return (
    <Section
      title={t('{{month}} compared with {{previous}}', {
        month,
        previous: previousMonth,
      })}
    >
      {rows.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>No transactions in this period.</Trans>
          </Text>
        </View>
      ) : (
        rows.map(row => (
          <View key={row.name} style={rowStyle}>
            <Text style={{ flex: 2 }}>{row.name}</Text>
            <FinancialText style={cell}>{money(row.current)}</FinancialText>
            <FinancialText style={{ ...cell, color: theme.pageTextSubdued }}>
              {money(row.previous)}
            </FinancialText>
            <FinancialText
              style={{
                ...cell,
                color:
                  row.difference === 0
                    ? undefined
                    : row.difference > 0 === (kind === 'expenses')
                      ? theme.errorText
                      : theme.noticeTextLight,
              }}
            >
              {row.change == null
                ? '—'
                : `${row.change > 0 ? '+' : ''}${(row.change * 100).toFixed(0)} %`}
            </FinancialText>
          </View>
        ))
      )}
    </Section>
  );
}
