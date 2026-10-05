import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type {
  DebtDirection,
  DebtEntity,
  DebtKind,
} from '@actual-app/core/types/models';

import { parseDecimal, toErrorMessage } from '#components/investments/format';
import { FormField } from '#components/investments/FormField';

type DebtFormProps = {
  debt?: DebtEntity;
  onDone: () => void;
  onError: (message: string) => void;
};

export function DebtForm({ debt, onDone, onError }: DebtFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(debt?.name ?? '');
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'loan');
  const [direction, setDirection] = useState<DebtDirection>(
    debt?.direction ?? 'owed_by_me',
  );
  const [principal, setPrincipal] = useState(
    debt ? String(debt.principal / 100) : '',
  );
  const [rate, setRate] = useState(debt ? String(debt.interest_rate) : '');
  const [payment, setPayment] = useState(
    debt?.monthly_payment != null ? String(debt.monthly_payment / 100) : '',
  );
  const [startDate, setStartDate] = useState(debt?.start_date ?? '');

  const principalValue = parseDecimal(principal);
  const rateValue = rate === '' ? 0 : parseDecimal(rate);
  const paymentValue = payment === '' ? null : parseDecimal(payment);
  const canSave =
    name.trim() !== '' &&
    principalValue != null &&
    principalValue > 0 &&
    rateValue != null &&
    rateValue >= 0 &&
    (payment === '' || paymentValue != null);

  async function onSave() {
    if (principalValue == null || rateValue == null) {
      return;
    }
    try {
      const fields = {
        name: name.trim(),
        kind,
        direction,
        principal: Math.round(principalValue * 100),
        interest_rate: rateValue,
        monthly_payment:
          paymentValue == null ? null : Math.round(paymentValue * 100),
        start_date: startDate || null,
      };
      if (debt) {
        await send('debt-update', { id: debt.id, ...fields });
      } else {
        await send('debt-create', fields);
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
        flexShrink: 0,
      }}
    >
      <FormField label={t('Name')} width={200}>
        <Input
          value={name}
          onChangeValue={setName}
          placeholder={t('Car loan')}
        />
      </FormField>
      <FormField label={t('Type')}>
        <Select
          value={kind}
          onChange={setKind}
          options={[
            ['loan', t('Loan')],
            ['debt', t('Debt')],
            ['mortgage', t('Mortgage')],
          ]}
        />
      </FormField>
      <FormField label={t('Who owes')} width={170}>
        <Select
          value={direction}
          onChange={setDirection}
          options={[
            ['owed_by_me', t('I owe')],
            ['owed_to_me', t('I am owed')],
          ]}
        />
      </FormField>
      <FormField label={t('Amount')} width={120}>
        <Input
          value={principal}
          onChangeValue={setPrincipal}
          placeholder="10000"
        />
      </FormField>
      <FormField label={t('Yearly interest %')} width={120}>
        <Input value={rate} onChangeValue={setRate} placeholder="0" />
      </FormField>
      <FormField label={t('Monthly payment')} width={130}>
        <Input value={payment} onChangeValue={setPayment} />
      </FormField>
      <FormField label={t('Start date')} width={150}>
        <Input type="date" value={startDate} onChangeValue={setStartDate} />
      </FormField>
      <Button variant="primary" isDisabled={!canSave} onPress={onSave}>
        <Trans>Save</Trans>
      </Button>
    </View>
  );
}
