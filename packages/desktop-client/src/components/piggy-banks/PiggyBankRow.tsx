import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { PiggyBankProgress } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { parseDecimal, toErrorMessage } from '#components/investments/format';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';

import { PiggyBankForm } from './PiggyBankForm';

type PiggyBankRowProps = {
  piggy: PiggyBankProgress;
  money: (cents: number) => string;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function PiggyBankRow({
  piggy,
  money,
  onChanged,
  onError,
}: PiggyBankRowProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const { data: accounts = [] } = useAccounts();
  const [isEditing, setIsEditing] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const { data: { list: categories } = { list: [] } } = useCategories();
  const [accountId, setAccountId] = useState(piggy.account_id ?? '');
  const value = parseDecimal(amount);
  const cents = value == null ? null : Math.round(value * 100);
  const done = piggy.percent != null && piggy.percent >= 100;

  async function move(sign: 1 | -1) {
    if (cents == null || cents <= 0) {
      return;
    }
    try {
      await send('piggy-bank-move', {
        id: piggy.id,
        amount: sign * cents,
        accountId: accountId || null,
        categoryId: categoryId || null,
      });
      setAmount('');
      onChanged();
    } catch (error) {
      onError(toErrorMessage(error));
    }
  }

  async function onDelete() {
    await send('piggy-bank-delete', { id: piggy.id });
    onChanged();
  }

  return (
    <View>
      <View style={{ ...rowStyle, flexWrap: 'wrap' }}>
        <View style={{ flex: '2 1 200px', gap: 8 }}>
          <Text style={{ fontWeight: 500 }}>{piggy.name}</Text>
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
                borderRadius: 3,
                width: `${piggy.percent ?? 0}%`,
                backgroundColor: done
                  ? theme.noticeTextLight
                  : theme.buttonPrimaryBackground,
              }}
            />
          </View>
        </View>
        <View style={{ flex: '1 1 150px', alignItems: 'flex-end', gap: 2 }}>
          <FinancialText style={{ fontFamily: monoFont }}>
            {money(piggy.saved)} / {money(piggy.target_amount)}
          </FinancialText>
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {piggy.monthlyNeeded != null
              ? t('{{amount}} per month until {{date}}', {
                  amount: money(piggy.monthlyNeeded),
                  date: piggy.target_date,
                })
              : done
                ? t('Target reached')
                : (piggy.target_date ?? '')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Select
            value={accountId}
            onChange={setAccountId}
            options={[
              ['', t('No account')],
              ...accounts
                .filter(account => !account.closed)
                .map(account => [account.id, account.name] as [string, string]),
            ]}
          />
          {accountId && (
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={[
                ['', t('No category')],
                ...categories
                  .filter(category => !category.hidden)
                  .map(
                    category =>
                      [category.id, category.name] as [string, string],
                  ),
              ]}
            />
          )}
          <Input
            value={amount}
            onChangeValue={setAmount}
            placeholder={t('Amount')}
            style={{ width: 90 }}
          />
          <Button
            isDisabled={cents == null || cents <= 0}
            onPress={() => move(1)}
          >
            <Trans>Add</Trans>
          </Button>
          <Button
            isDisabled={cents == null || cents <= 0}
            onPress={() => move(-1)}
          >
            <Trans>Take out</Trans>
          </Button>
          <Button variant="bare" onPress={() => setIsEditing(!isEditing)}>
            <Trans>Edit</Trans>
          </Button>
          <Button variant="bare" onPress={onDelete}>
            <Trans>Delete</Trans>
          </Button>
        </View>
      </View>
      {isEditing && (
        <View style={{ padding: '0 25px 16px' }}>
          <PiggyBankForm
            piggy={piggy}
            onDone={() => {
              setIsEditing(false);
              onChanged();
            }}
            onError={onError}
          />
        </View>
      )}
    </View>
  );
}
