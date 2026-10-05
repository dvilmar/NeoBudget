import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { monthlyCost } from '@actual-app/core/shared/subscriptions';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { monoFont } from '#components/overview/monoFont';
import { rowStyle } from '#components/overview/rowStyle';

type SubscriptionRowProps = {
  schedule: ScheduleEntity;
  isSubscription: boolean;
  groupName: string | null;
  money: (cents: number) => string;
  onChanged: () => void;
};

export function SubscriptionRow({
  schedule,
  isSubscription,
  groupName,
  money,
  onChanged,
}: SubscriptionRowProps) {
  const { t } = useTranslation();
  const amount = typeof schedule._amount === 'number' ? schedule._amount : null;
  const cost = amount == null ? null : monthlyCost(amount, schedule._date);

  async function onToggle() {
    await send('subscription-set', {
      scheduleId: schedule.id,
      isSubscription: !isSubscription,
    });
    onChanged();
  }

  async function onGroup(value: string) {
    await send('subscription-set', {
      scheduleId: schedule.id,
      isSubscription: true,
      groupName: value,
    });
    onChanged();
  }

  return (
    <View style={rowStyle}>
      <View style={{ flex: 2 }}>
        <Text style={{ fontWeight: 500 }}>{schedule.name || t('Unnamed')}</Text>
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          {t('Next: {{date}}', { date: schedule.next_date })}
        </Text>
      </View>
      <FinancialText
        style={{ flex: 1, textAlign: 'right', fontFamily: monoFont }}
      >
        {amount == null ? '—' : money(Math.abs(amount))}
      </FinancialText>
      <FinancialText
        style={{
          flex: 1,
          textAlign: 'right',
          fontFamily: monoFont,
          color: theme.pageTextLight,
        }}
      >
        {cost == null ? '—' : t('{{amount}} / month', { amount: money(cost) })}
      </FinancialText>
      {isSubscription && (
        <Input
          defaultValue={groupName ?? ''}
          placeholder={t('Group')}
          onUpdate={onGroup}
          style={{ width: 120 }}
        />
      )}
      <Button onPress={onToggle}>
        {isSubscription ? (
          <Trans>Remove</Trans>
        ) : (
          <Trans>Mark as subscription</Trans>
        )}
      </Button>
    </View>
  );
}
