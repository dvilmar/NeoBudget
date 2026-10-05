import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { useQuery } from '@tanstack/react-query';

import { aqlQuery } from '#queries/aqlQuery';

import { monoFont } from './monoFont';
import { rowStyle } from './rowStyle';
import { Section } from './Section';

type CategoryTotal = { name: string; total: number };

export function TopSpending({
  money,
  month,
}: {
  money: (cents: number) => string;
  month: string;
}) {
  const { t } = useTranslation();

  const { data: rows = [] } = useQuery({
    queryKey: ['overview', 'top-spending', month],
    queryFn: async (): Promise<CategoryTotal[]> => {
      const { data } = await aqlQuery(
        q('transactions')
          .filter({
            date: {
              $gte: monthUtils.firstDayOfMonth(month),
              $lte: monthUtils.lastDayOfMonth(month),
            },
            amount: { $lt: 0 },
            'category.is_income': false,
          })
          .options({ splits: 'inline' })
          .groupBy('category.name')
          .select(['category.name', { total: { $sum: '$amount' } }]),
      );
      return (data as Record<string, unknown>[])
        .map(row => ({
          name: String(row['category.name'] ?? ''),
          total: Number(row.total ?? 0),
        }))
        .filter(row => row.name !== '')
        .sort((a, b) => a.total - b.total)
        .slice(0, 6);
    },
  });

  const biggest = Math.max(...rows.map(row => Math.abs(row.total)), 1);

  return (
    <Section title={t('Top spending this month')}>
      {rows.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>No spending yet.</Trans>
          </Text>
        </View>
      ) : (
        rows.map(row => (
          <View key={row.name} style={{ ...rowStyle, display: 'block' }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text>{row.name}</Text>
              <Text style={{ fontFamily: monoFont, fontSize: 13 }}>
                {money(Math.abs(row.total))}
              </Text>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.pillBackground,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${(Math.abs(row.total) / biggest) * 100}%`,
                  backgroundColor: theme.buttonPrimaryBackground,
                }}
              />
            </View>
          </View>
        ))
      )}
    </Section>
  );
}
