import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { PiggyBankEntity } from '@actual-app/core/types/models';

import { parseDecimal, toErrorMessage } from '#components/investments/format';
import { FormField } from '#components/investments/FormField';

type PiggyBankFormProps = {
  piggy?: PiggyBankEntity;
  onDone: () => void;
  onError: (message: string) => void;
};

export function PiggyBankForm({ piggy, onDone, onError }: PiggyBankFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(piggy?.name ?? '');
  const [target, setTarget] = useState(
    piggy ? String(piggy.target_amount / 100) : '',
  );
  const [targetDate, setTargetDate] = useState(piggy?.target_date ?? '');
  const [groupName, setGroupName] = useState(piggy?.group_name ?? '');

  const targetValue = parseDecimal(target);
  const canSave = name.trim() !== '' && targetValue != null && targetValue > 0;

  async function onSave() {
    if (targetValue == null) {
      return;
    }
    try {
      const fields = {
        name: name.trim(),
        target_amount: Math.round(targetValue * 100),
        target_date: targetDate || null,
        group_name: groupName.trim() || null,
      };
      if (piggy) {
        await send('piggy-bank-update', { id: piggy.id, ...fields });
      } else {
        await send('piggy-bank-create', fields);
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
      <FormField label={t('Name')} width={220}>
        <Input
          value={name}
          onChangeValue={setName}
          placeholder={t('Holiday')}
        />
      </FormField>
      <FormField label={t('Target amount')} width={130}>
        <Input value={target} onChangeValue={setTarget} placeholder="1000" />
      </FormField>
      <FormField label={t('Target date (optional)')} width={170}>
        <Input type="date" value={targetDate} onChangeValue={setTargetDate} />
      </FormField>
      <FormField label={t('Group (optional)')} width={150}>
        <Input value={groupName} onChangeValue={setGroupName} />
      </FormField>
      <Button variant="primary" isDisabled={!canSave} onPress={onSave}>
        <Trans>Save piggy bank</Trans>
      </Button>
    </View>
  );
}
