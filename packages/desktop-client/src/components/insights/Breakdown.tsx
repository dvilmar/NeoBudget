import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import type { Total } from './queries';

type BreakdownProps = {
  title: string;
  rows: Total[];
  money: (cents: number) => string;
};

export function Breakdown({ title, rows, money }: BreakdownProps) {
  const biggest = Math.max(...rows.map(row => row.total), 1);
  const sum = rows.reduce((total, row) => total + row.total, 0);

  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>No transactions in this period.</Trans>
          </Text>
        </View>
      ) : (
        <>
          {rows.map(row => (
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
                  {money(row.total)}
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
                    width: `${(row.total / biggest) * 100}%`,
                    backgroundColor: theme.buttonPrimaryBackground,
                  }}
                />
              </View>
            </View>
          ))}
          <View style={{ ...rowStyle, borderBottom: 'none', fontWeight: 600 }}>
            <Text style={{ flex: 1, fontWeight: 600 }}>
              <Trans>Total</Trans>
            </Text>
            <Text style={{ fontFamily: monoFont, fontWeight: 600 }}>
              {money(sum)}
            </Text>
          </View>
        </>
      )}
    </Section>
  );
}
