import { useTranslation } from 'react-i18next';

import * as monthUtils from '@actual-app/core/shared/months';

import { useSheetValue } from '#hooks/useSheetValue';
import type { Binding } from '#spreadsheet';

import { Stat } from './Stat';

export function LeftPerDayStat({
  money,
  month,
  first,
}: {
  money: (cents: number) => string;
  month: string;
  first?: boolean;
}) {
  const { t } = useTranslation();
  const left =
    useSheetValue<'envelope-budget', 'total-leftover'>(
      'total-leftover' as Binding<'envelope-budget', 'total-leftover'>,
    ) ?? 0;

  // Only upcoming days count in the current month.
  const today = monthUtils.currentDay();
  const isCurrent = month === monthUtils.currentMonth();
  const startDay = isCurrent ? today : monthUtils.firstDayOfMonth(month);
  const lastDay = monthUtils.lastDayOfMonth(month);
  const daysLeft = Math.max(
    Math.round(
      (new Date(`${lastDay}T12:00:00`).getTime() -
        new Date(`${startDay}T12:00:00`).getTime()) /
        86400000,
    ) + 1,
    1,
  );

  return (
    <Stat
      first={first}
      label={t('Left to spend per day')}
      value={money(Math.round(left / daysLeft))}
      note={t('{{amount}} left this month', { amount: money(left) })}
    />
  );
}
