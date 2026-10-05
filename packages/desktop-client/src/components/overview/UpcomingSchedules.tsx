import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { q } from '@actual-app/core/shared/query';

import { FinancialText } from '#components/FinancialText';
import { useSchedules } from '#hooks/useSchedules';

import { monoFont } from './monoFont';
import { rowStyle } from './rowStyle';
import { Section } from './Section';

export function UpcomingSchedules({
  money,
}: {
  money: (cents: number) => string;
}) {
  const { t } = useTranslation();
  const { schedules = [] } = useSchedules({
    query: useMemo(() => q('schedules').select('*'), []),
  });

  const upcoming = [...schedules]
    .filter(schedule => !schedule.completed && schedule.next_date)
    .sort((a, b) => a.next_date.localeCompare(b.next_date))
    .slice(0, 5);

  return (
    <Section title={t('Upcoming bills')}>
      {upcoming.length === 0 ? (
        <View style={rowStyle}>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>Nothing scheduled.</Trans>
          </Text>
        </View>
      ) : (
        upcoming.map(schedule => (
          <View key={schedule.id} style={rowStyle}>
            <View style={{ flex: 1 }}>
              <Text>{schedule.name || t('Unnamed')}</Text>
              <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
                {schedule.next_date}
              </Text>
            </View>
            {typeof schedule._amount === 'number' && (
              <FinancialText style={{ fontFamily: monoFont }}>
                {money(schedule._amount)}
              </FinancialText>
            )}
          </View>
        ))
      )}
    </Section>
  );
}
