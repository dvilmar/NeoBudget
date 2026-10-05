import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { buildDividendCalendar } from '@actual-app/core/shared/dividend-calendar';
import { currentDay } from '@actual-app/core/shared/months';
import type { InvestmentTradeEntity } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import { formatMoney } from './format';

type DividendCalendarProps = {
  trades: InvestmentTradeEntity[];
  activeAssetIds: Set<string>;
  baseCurrency: string;
  language: string;
};

export function DividendCalendar({
  trades,
  activeAssetIds,
  baseCurrency,
  language,
}: DividendCalendarProps) {
  const { t } = useTranslation();
  const months = buildDividendCalendar(trades, currentDay(), {
    activeAssetIds,
  });
  const totalReceived = months.reduce((sum, m) => sum + m.received, 0);
  const totalEstimated = months.reduce((sum, m) => sum + m.estimated, 0);

  if (totalReceived === 0 && totalEstimated === 0) {
    return null;
  }

  return (
    <Section title={t('Dividend calendar')}>
      {months.map(({ month, received, estimated }) => {
        if (received === 0 && estimated === 0) {
          return null;
        }
        return (
          <View key={month} style={rowStyle}>
            <Text style={{ flex: 1, fontFamily: monoFont }}>{month}</Text>
            <FinancialText style={{ flex: 1, textAlign: 'right' }}>
              {received > 0
                ? formatMoney(received, baseCurrency, language)
                : ''}
            </FinancialText>
            <FinancialText
              style={{
                flex: 1,
                textAlign: 'right',
                color: theme.pageTextSubdued,
              }}
            >
              {estimated > 0
                ? `~ ${formatMoney(estimated, baseCurrency, language)}`
                : ''}
            </FinancialText>
          </View>
        );
      })}
      <View style={{ ...rowStyle, color: theme.pageTextSubdued, fontSize: 12 }}>
        <Text style={{ flex: 1 }}>
          <Trans>Received / estimated</Trans>
        </Text>
        <FinancialText style={{ flex: 1, textAlign: 'right' }}>
          {formatMoney(totalReceived, baseCurrency, language)}
        </FinancialText>
        <FinancialText style={{ flex: 1, textAlign: 'right' }}>
          {`~ ${formatMoney(totalEstimated, baseCurrency, language)}`}
        </FinancialText>
      </View>
    </Section>
  );
}
