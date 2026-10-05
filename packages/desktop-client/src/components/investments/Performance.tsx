import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { FinancialText } from '#components/FinancialText';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';
import { Stat } from '#components/overview/Stat';

import { formatMoney, formatPercent } from './format';

import { investmentsQueryKey } from '.';

type PerformanceProps = {
  benchmarks: { id: string; name: string }[];
  baseCurrency: string;
  language: string;
};

type CurvePoint = { date: string; value: number };

function Curve({ main, other }: { main: CurvePoint[]; other: CurvePoint[] }) {
  if (main.length < 2) {
    return null;
  }
  const all = [...main, ...other].map(point => point.value);
  const min = Math.min(...all, 0);
  const range = Math.max(...all, 0) - min || 1;
  const y = (value: number) => 46 - ((value - min) / range) * 42;
  const x = new Map(
    main.map((point, index) => [point.date, (index / (main.length - 1)) * 200]),
  );
  const toPoints = (list: CurvePoint[]) =>
    list
      .filter(point => x.has(point.date))
      .map(point => `${x.get(point.date)},${y(point.value)}`)
      .join(' ');

  return (
    <svg
      viewBox="0 0 200 50"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: '100%', height: 90 }}
    >
      <line
        x1={0}
        x2={200}
        y1={y(0)}
        y2={y(0)}
        stroke={theme.tableBorder}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={toPoints(other)}
        fill="none"
        stroke={theme.pageTextSubdued}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={toPoints(main)}
        fill="none"
        stroke={theme.buttonPrimaryBackground}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Performance({
  benchmarks,
  baseCurrency,
  language,
}: PerformanceProps) {
  const [benchmarkId, setBenchmarkId] = useState('');
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: [
      ...investmentsQueryKey,
      'performance',
      baseCurrency,
      benchmarkId,
    ],
    queryFn: () =>
      send('investment-performance', {
        baseCurrency,
        benchmarkAssetId: benchmarkId || undefined,
      }),
  });

  if (!data || data.curve.length < 2) {
    return null;
  }

  const gainColor = (value: number | null) =>
    !value
      ? theme.pageTextSubdued
      : value > 0
        ? theme.noticeTextLight
        : theme.errorText;

  return (
    <View style={{ gap: 16, flexShrink: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          border: `1px solid ${theme.tableBorder}`,
          borderRadius: 8,
          backgroundColor: theme.cardBackground,
        }}
      >
        <Stat
          first
          label={t('Return (12 months)')}
          value={formatPercent(data.twr, language)}
          note={t('Time-weighted, ignores deposits')}
          noteColor={gainColor(data.twr)}
        />
        <Stat
          label={t('Gain')}
          value={formatMoney(data.gain, baseCurrency, language)}
          note={`${t('Contributed')} ${formatMoney(data.contributed, baseCurrency, language)}`}
          noteColor={gainColor(data.gain)}
        />
        <Stat
          label={t('Dividends')}
          value={formatMoney(data.income, baseCurrency, language)}
          note={t('Last 12 months')}
        />
      </View>

      <Section title={t('Return over time')}>
        <View style={{ padding: '8px 20px', gap: 8 }}>
          {benchmarks.length > 0 && (
            <Select
              value={benchmarkId}
              onChange={setBenchmarkId}
              options={[
                ['', t('No benchmark')],
                ...benchmarks.map(
                  benchmark =>
                    [benchmark.id, benchmark.name] as [string, string],
                ),
              ]}
            />
          )}
          <Curve main={data.curve} other={data.benchmarkCurve} />
        </View>
      </Section>

      {data.dividendsByAsset.length > 0 && (
        <Section title={t('Dividends by asset')}>
          {data.dividendsByAsset.map(row => (
            <View key={row.assetId} style={rowStyle}>
              <Text style={{ flex: 2 }}>{row.name}</Text>
              <FinancialText
                style={{ flex: 1, textAlign: 'right', fontFamily: monoFont }}
              >
                {formatMoney(row.amount, baseCurrency, language)}
              </FinancialText>
            </View>
          ))}
          {data.dividendsByMonth.length > 0 && (
            <View
              style={{
                ...rowStyle,
                color: theme.pageTextSubdued,
                fontSize: 12,
              }}
            >
              <Text style={{ flex: 1 }}>
                <Trans>Months with dividends</Trans>:{' '}
                {data.dividendsByMonth.map(row => row.month).join(', ')}
              </Text>
            </View>
          )}
        </Section>
      )}
    </View>
  );
}
