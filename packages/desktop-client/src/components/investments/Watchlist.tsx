import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { InvestmentPositionEntity } from '@actual-app/core/types/models';

import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { Section } from '#components/overview/Section';

import { formatMoney, toErrorMessage } from './format';

type WatchlistProps = {
  positions: InvestmentPositionEntity[];
  defaultCurrency: string;
  language: string;
  onChanged: () => void;
  onError: (message: string) => void;
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function Watchlist({
  positions,
  defaultCurrency,
  language,
  onChanged,
  onError,
}: WatchlistProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const watched = positions.filter(position => position.asset.watched);

  async function onAdd() {
    try {
      await send('investment-watchlist-import', {
        text,
        defaultCurrency,
      });
      setText('');
      onChanged();
    } catch (error) {
      onError(toErrorMessage(error));
    }
  }

  async function onRemove(position: InvestmentPositionEntity) {
    // An asset with trades stays, it only leaves the watchlist
    if (position.quantity === 0 && position.costBasis === 0) {
      await send('investment-asset-delete', { id: position.asset.id });
    } else {
      await send('investment-asset-update', {
        id: position.asset.id,
        watched: 0,
      });
    }
    onChanged();
  }

  async function onExport(kind: 'trades' | 'watchlist') {
    download(`${kind}.csv`, await send('investment-export-csv', { kind }));
  }

  return (
    <Section title={t('Watchlist')}>
      <View style={{ ...rowStyle, gap: 8, flexWrap: 'wrap' }}>
        <Input
          value={text}
          onChangeValue={setText}
          placeholder={t('Symbols, e.g. AAPL, VWCE.DE')}
          style={{ flex: 1, minWidth: 220 }}
        />
        <Button isDisabled={text.trim() === ''} onPress={onAdd}>
          <Trans>Add to watchlist</Trans>
        </Button>
        <Button onPress={() => onExport('watchlist')}>
          <Trans>Export watchlist</Trans>
        </Button>
        <Button onPress={() => onExport('trades')}>
          <Trans>Export trades</Trans>
        </Button>
      </View>
      {watched.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>Nothing on the watchlist yet.</Trans>
          </Text>
        </View>
      ) : (
        watched.map(position => (
          <View key={position.asset.id} style={rowStyle}>
            <Text style={{ flex: 1 }}>{position.asset.symbol}</Text>
            <Text style={{ flex: 2, color: theme.pageTextLight }}>
              {position.asset.name}
            </Text>
            <Text style={{ flex: 1, textAlign: 'right', fontFamily: monoFont }}>
              {position.price == null
                ? '—'
                : formatMoney(
                    position.price,
                    position.asset.currency,
                    language,
                  )}
            </Text>
            <Button variant="bare" onPress={() => onRemove(position)}>
              <Trans>Remove</Trans>
            </Button>
          </View>
        ))
      )}
    </Section>
  );
}
