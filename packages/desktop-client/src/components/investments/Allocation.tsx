import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { InvestmentPositionEntity } from '@actual-app/core/types/models';

import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import { formatPercent } from './format';

type AllocationProps = {
  positions: InvestmentPositionEntity[];
  language: string;
};

function group(
  positions: InvestmentPositionEntity[],
  key: (position: InvestmentPositionEntity) => string,
) {
  const totals = new Map<string, number>();
  for (const position of positions) {
    const value = position.base?.marketValue ?? 0;
    if (value > 0) {
      totals.set(key(position), (totals.get(key(position)) ?? 0) + value);
    }
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([name, value]) => ({
      name,
      share: sum > 0 ? (value / sum) * 100 : 0,
    }))
    .sort((a, b) => b.share - a.share);
}

function Bars({
  title,
  rows,
  language,
}: {
  title: string;
  rows: { name: string; share: number }[];
  language: string;
}) {
  return (
    <View style={{ flex: '1 1 320px', minWidth: 0 }}>
      <Section title={title}>
        {rows.length === 0 ? (
          <View style={rowStyle}>
            <Text style={{ color: theme.pageTextSubdued }}>
              <Trans>Nothing with a value yet.</Trans>
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
                  {formatPercent(row.share, language).replace('+', '')}
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
                    width: `${row.share}%`,
                    backgroundColor: theme.buttonPrimaryBackground,
                  }}
                />
              </View>
            </View>
          ))
        )}
      </Section>
    </View>
  );
}

export function Allocation({ positions, language }: AllocationProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 28,
        flexShrink: 0,
        alignItems: 'flex-start',
      }}
    >
      <Bars
        title={t('By type')}
        rows={group(positions, position => position.asset.type)}
        language={language}
      />
      <Bars
        title={t('By currency')}
        rows={group(positions, position => position.asset.currency)}
        language={language}
      />
      <Bars
        title={t('By asset')}
        rows={group(positions, position => position.asset.symbol)}
        language={language}
      />
    </View>
  );
}
