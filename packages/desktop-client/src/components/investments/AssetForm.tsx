import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  InvestmentAssetEntity,
  InvestmentAssetType,
} from '@actual-app/core/types/models';

import { toErrorMessage } from './format';
import { FormField } from './FormField';

type AssetFormProps = {
  asset?: InvestmentAssetEntity;
  defaultCurrency: string;
  onDone: () => void;
  onError: (message: string) => void;
};

export function AssetForm({
  asset,
  defaultCurrency,
  onDone,
  onError,
}: AssetFormProps) {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState(asset?.symbol ?? '');
  const [name, setName] = useState(asset?.name ?? '');
  const [type, setType] = useState<InvestmentAssetType>(asset?.type ?? 'etf');
  const [currency, setCurrency] = useState(asset?.currency ?? defaultCurrency);
  const [priceSource, setPriceSource] = useState(
    asset ? (asset.price_source ?? '') : 'yahoo',
  );
  const [priceSourceId, setPriceSourceId] = useState(
    asset?.price_source_id ?? '',
  );

  const canSave = symbol.trim() !== '' && currency.trim().length >= 3;

  async function onSave() {
    try {
      const fields = {
        symbol: symbol.trim(),
        name: name.trim() || symbol.trim(),
        type,
        currency: currency.trim(),
        price_source: priceSource || null,
        price_source_id: priceSource
          ? priceSourceId.trim() || symbol.trim()
          : null,
      };
      if (asset) {
        await send('investment-asset-update', { id: asset.id, ...fields });
      } else {
        await send('investment-asset-create', fields);
      }
      onDone();
    } catch (error) {
      onError(toErrorMessage(error));
    }
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 12,
      }}
    >
      <FormField label={t('Symbol')} width={110}>
        <Input value={symbol} onChangeValue={setSymbol} placeholder="VWCE" />
      </FormField>
      <FormField label={t('Name')} width={220}>
        <Input value={name} onChangeValue={setName} />
      </FormField>
      <FormField label={t('Type')}>
        <Select
          value={type}
          onChange={setType}
          options={[
            ['etf', t('ETF')],
            ['stock', t('Stock')],
            ['fund', t('Fund')],
            ['bond', t('Bond')],
            ['crypto', t('Crypto')],
            ['other', t('Other')],
          ]}
        />
      </FormField>
      <FormField label={t('Currency')} width={90}>
        <Input value={currency} onChangeValue={setCurrency} placeholder="EUR" />
      </FormField>
      <FormField label={t('Price source')}>
        <Select
          value={priceSource}
          onChange={setPriceSource}
          options={[
            ['yahoo', 'Yahoo Finance'],
            ['coingecko', 'CoinGecko'],
            ['', t('Manual')],
          ]}
        />
      </FormField>
      {priceSource !== '' && (
        <FormField label={t('Id in the price source')} width={170}>
          <Input
            value={priceSourceId}
            onChangeValue={setPriceSourceId}
            placeholder={priceSource === 'yahoo' ? 'VWCE.DE' : 'bitcoin'}
          />
        </FormField>
      )}
      <Button variant="primary" isDisabled={!canSave} onPress={onSave}>
        <Trans>Save asset</Trans>
      </Button>
    </View>
  );
}
