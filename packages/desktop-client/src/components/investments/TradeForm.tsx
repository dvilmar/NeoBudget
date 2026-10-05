import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { currentDay } from '@actual-app/core/shared/months';
import type {
  InvestmentAssetEntity,
  InvestmentTradeEntity,
  InvestmentTradeType,
} from '@actual-app/core/types/models';

import { useAccounts } from '#hooks/useAccounts';

import { parseDecimal, toErrorMessage } from './format';
import { FormField } from './FormField';

type TradeFormProps = {
  trade?: InvestmentTradeEntity;
  assets: InvestmentAssetEntity[];
  onDone: () => void;
  onError: (message: string) => void;
};

export function TradeForm({ trade, assets, onDone, onError }: TradeFormProps) {
  const { t } = useTranslation();
  const { data: accounts = [] } = useAccounts();
  const [assetId, setAssetId] = useState(
    trade?.asset_id ?? assets[0]?.id ?? '',
  );
  const [accountId, setAccountId] = useState(trade?.account_id ?? '');
  const [type, setType] = useState<InvestmentTradeType>(trade?.type ?? 'buy');
  const [date, setDate] = useState(trade?.date ?? currentDay());
  const [quantity, setQuantity] = useState(trade ? String(trade.quantity) : '');
  const [price, setPrice] = useState(trade ? String(trade.price) : '');
  const [fee, setFee] = useState(trade?.fee ? String(trade.fee) : '');

  const parsedQuantity = parseDecimal(quantity);
  const parsedPrice = parseDecimal(price);
  const parsedFee = fee.trim() === '' ? 0 : parseDecimal(fee);
  const canSave =
    assetId !== '' &&
    date !== '' &&
    parsedQuantity != null &&
    parsedPrice != null &&
    parsedFee != null;

  async function onSave() {
    if (parsedQuantity == null || parsedPrice == null || parsedFee == null) {
      return;
    }
    try {
      const fields = {
        asset_id: assetId,
        account_id: accountId || null,
        date,
        type,
        quantity: parsedQuantity,
        price: parsedPrice,
        fee: parsedFee,
      };
      if (trade) {
        await send('investment-trade-update', { id: trade.id, ...fields });
      } else {
        await send('investment-trade-create', fields);
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
      <FormField label={t('Asset')} width={180}>
        <Select
          value={assetId}
          onChange={setAssetId}
          options={assets.map(asset => [asset.id, asset.symbol] as const)}
        />
      </FormField>
      <FormField label={t('Type')}>
        <Select
          value={type}
          onChange={setType}
          options={[
            ['buy', t('Buy')],
            ['sell', t('Sell')],
            ['dividend', t('Dividend')],
            ['fee', t('Fee')],
          ]}
        />
      </FormField>
      <FormField label={t('Date')} width={150}>
        <Input type="date" value={date} onChangeValue={setDate} />
      </FormField>
      <FormField label={t('Quantity')} width={110}>
        <Input value={quantity} onChangeValue={setQuantity} />
      </FormField>
      <FormField label={t('Price per unit')} width={110}>
        <Input value={price} onChangeValue={setPrice} />
      </FormField>
      <FormField label={t('Fee')} width={90}>
        <Input value={fee} onChangeValue={setFee} placeholder="0" />
      </FormField>
      <FormField label={t('Account')} width={180}>
        <Select
          value={accountId}
          onChange={setAccountId}
          options={[
            ['', t('No account')] as const,
            ...accounts
              .filter(account => !account.closed)
              .map(account => [account.id, account.name] as const),
          ]}
        />
      </FormField>
      <Button variant="primary" isDisabled={!canSave} onPress={onSave}>
        <Trans>Save trade</Trans>
      </Button>
    </View>
  );
}
