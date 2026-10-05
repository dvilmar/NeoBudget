import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { DebtProgress } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { parseDecimal, toErrorMessage } from '#components/investments/format';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';

import { AmortizationTable } from './AmortizationTable';
import { DebtForm } from './DebtForm';

type DebtRowProps = {
  debt: DebtProgress;
  money: (cents: number) => string;
  onChanged: () => void;
  onError: (message: string) => void;
};

export function DebtRow({ debt, money, onChanged, onError }: DebtRowProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const { data: accounts = [] } = useAccounts();
  const [isEditing, setIsEditing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const { data: { list: categories } = { list: [] } } = useCategories();
  const [accountId, setAccountId] = useState(debt.account_id ?? '');
  const [interest, setInterest] = useState('');

  const value = parseDecimal(amount);
  const cents = value == null ? null : Math.round(value * 100);
  const interestValue = interest === '' ? null : parseDecimal(interest);
  const canPay =
    cents != null && cents > 0 && (interest === '' || interestValue != null);

  async function onPay() {
    if (cents == null) {
      return;
    }
    try {
      await send('debt-payment-create', {
        debt_id: debt.id,
        amount: cents,
        accountId: accountId || null,
        categoryId: categoryId || null,
        // Left empty, the interest of the month is assumed
        interest:
          interestValue == null
            ? Math.min(debt.nextInterest, cents)
            : Math.round(interestValue * 100),
      });
      setAmount('');
      setInterest('');
      onChanged();
    } catch (error) {
      onError(toErrorMessage(error));
    }
  }

  async function onDelete() {
    await send('debt-delete', { id: debt.id });
    onChanged();
  }

  const detail =
    debt.outstanding === 0
      ? t('Paid off')
      : debt.monthsLeft != null
        ? t('{{count}} months left', { count: debt.monthsLeft })
        : debt.interest_rate > 0
          ? t('About {{amount}} of interest next month', {
              amount: money(debt.nextInterest),
            })
          : '';

  return (
    <View>
      <View style={{ ...rowStyle, flexWrap: 'wrap' }}>
        <View style={{ flex: '2 1 200px', gap: 8 }}>
          <Text style={{ fontWeight: 500 }}>{debt.name}</Text>
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
                width: `${debt.percent}%`,
                backgroundColor:
                  debt.outstanding === 0
                    ? theme.noticeTextLight
                    : theme.buttonPrimaryBackground,
              }}
            />
          </View>
        </View>
        <View style={{ flex: '1 1 150px', alignItems: 'flex-end', gap: 2 }}>
          <FinancialText style={{ fontFamily: monoFont }}>
            {money(debt.outstanding)} / {money(debt.principal)}
          </FinancialText>
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            {detail}
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
            placeholder={t('Payment')}
            style={{ width: 90 }}
          />
          <Input
            value={interest}
            onChangeValue={setInterest}
            placeholder={t('Interest')}
            style={{ width: 80 }}
          />
          <Button isDisabled={!canPay} onPress={onPay}>
            <Trans>Pay</Trans>
          </Button>
          <Button variant="bare" onPress={() => setShowSchedule(!showSchedule)}>
            <Trans>Schedule</Trans>
          </Button>
          <Button variant="bare" onPress={() => setIsEditing(!isEditing)}>
            <Trans>Edit</Trans>
          </Button>
          <Button variant="bare" onPress={onDelete}>
            <Trans>Delete</Trans>
          </Button>
        </View>
      </View>
      {showSchedule && <AmortizationTable debt={debt} money={money} />}
      {isEditing && (
        <View style={{ padding: '0 25px 16px' }}>
          <DebtForm
            debt={debt}
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
