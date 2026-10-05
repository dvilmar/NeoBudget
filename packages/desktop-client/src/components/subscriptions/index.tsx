import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { q } from '@actual-app/core/shared/query';
import { monthlyCost } from '@actual-app/core/shared/subscriptions';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { formatMoney } from '#components/investments/format';
import { border } from '#components/overview/border';
import { Section } from '#components/overview/Section';
import { Stat } from '#components/overview/Stat';
import { Page } from '#components/Page';
import { useLanguage } from '#hooks/useLocale';
import { useSchedules } from '#hooks/useSchedules';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { SubscriptionRow } from './SubscriptionRow';

const queryKey = ['subscriptions'] as const;

export function Subscriptions() {
  const { t } = useTranslation();
  const language = useLanguage();
  const queryClient = useQueryClient();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const currency = defaultCurrencyCode || 'EUR';

  const { schedules = [] } = useSchedules({
    query: useMemo(() => q('schedules').select('*'), []),
  });
  const { data: marked = [] } = useQuery({
    queryKey,
    queryFn: () => send('subscriptions-get'),
  });

  const money = (cents: number) => formatMoney(cents / 100, currency, language);
  const active = schedules
    .filter(schedule => !schedule.completed)
    .sort((a, b) => a.next_date.localeCompare(b.next_date));
  const markedIds = marked.map(row => row.scheduleId);
  const groupOf = (id: string) =>
    marked.find(row => row.scheduleId === id)?.groupName ?? null;
  const subscriptions = active.filter(schedule =>
    markedIds.includes(schedule.id),
  );
  const others = active.filter(schedule => !markedIds.includes(schedule.id));
  const groups = [
    ...new Set(subscriptions.map(schedule => groupOf(schedule.id) ?? '')),
  ].sort();

  const perMonth = subscriptions.reduce(
    (total, schedule) =>
      total +
      (typeof schedule._amount === 'number'
        ? (monthlyCost(schedule._amount, schedule._date) ?? 0)
        : 0),
    0,
  );

  function reload() {
    void queryClient.invalidateQueries({ queryKey });
  }

  function renderRows(list: typeof active, isSubscription: boolean) {
    return list.map(schedule => (
      <SubscriptionRow
        key={schedule.id}
        schedule={schedule}
        isSubscription={isSubscription}
        groupName={groupOf(schedule.id)}
        money={money}
        onChanged={reload}
      />
    ));
  }

  return (
    <Page header={t('Subscriptions')}>
      <View style={{ gap: 28, paddingBottom: 40, maxWidth: 1100 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            flexShrink: 0,
            border,
            borderRadius: 8,
            backgroundColor: theme.cardBackground,
          }}
        >
          <Stat first label={t('Per month')} value={money(perMonth)} />
          <Stat label={t('Per year')} value={money(perMonth * 12)} />
          <Stat
            label={t('Subscriptions')}
            value={String(subscriptions.length)}
          />
        </View>

        {active.length === 0 && (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              There are no schedules yet. Create them in Schedules, then mark
              the ones that are subscriptions here.
            </Trans>
          </Text>
        )}
        {groups.map(group => (
          <Section key={group} title={group || t('Subscriptions')}>
            {renderRows(
              subscriptions.filter(
                schedule => (groupOf(schedule.id) ?? '') === group,
              ),
              true,
            )}
          </Section>
        ))}
        {others.length > 0 && (
          <Section title={t('Other schedules')}>
            {renderRows(others, false)}
          </Section>
        )}
      </View>
    </Page>
  );
}
