import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { currentDay } from '@actual-app/core/shared/months';

import { parseDecimal, toErrorMessage } from '#components/investments/format';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';

type RateRowProps = {
  currency: string;
  baseCurrency: string;
  rate: number | null;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function RateRow({
  currency,
  baseCurrency,
  rate,
  onChanged,
  onError,
}: RateRowProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const parsed = parseDecimal(value);

  async function onSave() {
    if (parsed == null || !(parsed > 0)) {
      return;
    }
    try {
      await send('investment-fx-rate-set', {
        base: currency,
        quote: baseCurrency,
        date: currentDay(),
        rate: parsed,
      });
      setValue('');
      onChanged();
    } catch (error) {
      onError(toErrorMessage(error));
    }
  }

  return (
    <View style={rowStyle}>
      <Text style={{ flex: 1 }}>
        1 {currency} = {baseCurrency}
      </Text>
      <Text
        style={{
          flex: 1,
          textAlign: 'right',
          fontFamily: monoFont,
          color: rate == null ? theme.errorText : undefined,
        }}
      >
        {rate == null ? t('No rate') : rate.toFixed(4)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Input
          value={value}
          onChangeValue={setValue}
          placeholder={t('Set by hand')}
          style={{ width: 110 }}
        />
        <Button isDisabled={parsed == null || !(parsed > 0)} onPress={onSave}>
          <Trans>Save</Trans>
        </Button>
      </View>
    </View>
  );
}
