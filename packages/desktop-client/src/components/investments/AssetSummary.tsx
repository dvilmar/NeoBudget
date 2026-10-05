import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { InvestmentPositionEntity } from '@actual-app/core/types/models';
import { useQuery } from '@tanstack/react-query';

import { border } from '#components/overview/border';
import { Sparkline } from '#components/overview/Sparkline';
import { Stat } from '#components/overview/Stat';

import { formatMoney, formatNumber, formatPercent } from './format';

type AssetSummaryProps = {
  position: InvestmentPositionEntity;
  language: string;
};

const PRICE_DAYS = 180;

export function AssetSummary({ position, language }: AssetSummaryProps) {
  const { t } = useTranslation();
  const { asset } = position;
  const currency = asset.currency;

  const { data: history = [] } = useQuery({
    queryKey: ['investments', 'price-history', asset.id, PRICE_DAYS],
    queryFn: () =>
      send('investment-price-history', {
        assetId: asset.id,
        days: PRICE_DAYS,
      }),
  });

  return (
    <View
      style={{
        flexShrink: 0,
        border,
        borderRadius: 8,
        backgroundColor: theme.cardBackground,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Stat
          first
          label={t('Quantity')}
          value={formatNumber(position.quantity, language)}
          note={`${t('Average cost')}: ${formatMoney(position.averageCost, currency, language)}`}
        />
        <Stat
          label={t('Value')}
          value={formatMoney(position.marketValue, currency, language)}
          note={
            position.price == null
              ? undefined
              : `${t('Price')}: ${formatMoney(position.price, currency, language)}`
          }
        />
        <Stat
          label={t('Unrealized gain')}
          value={formatMoney(position.unrealizedGain, currency, language)}
          note={formatPercent(position.unrealizedGainPercent, language)}
        />
        <Stat
          label={t('Dividends')}
          value={formatMoney(position.income, currency, language)}
        />
        <Stat
          label={t('Fees')}
          value={formatMoney(position.fees, currency, language)}
        />
      </View>
      <View
        style={{
          borderTop: border,
          padding: '12px 20px',
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          <Trans>Price, last {{ days: PRICE_DAYS }} days</Trans>
        </Text>
        {history.length < 2 ? (
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            <Trans>Not enough saved prices to draw a chart yet.</Trans>
          </Text>
        ) : (
          <Sparkline values={history.map(point => point.price)} />
        )}
      </View>
    </View>
  );
}
