import type { RecurConfig } from '#types/models';

const WEEKS_PER_MONTH = 52 / 12;
const DAYS_PER_MONTH = 365 / 12;

// How many times a schedule charges in an average month. Null for
// schedules that are not regular, such as a single date.
export function chargesPerMonth(date: RecurConfig | string): number | null {
  if (typeof date === 'string') {
    return null;
  }

  const interval = Math.max(date.interval ?? 1, 1);
  switch (date.frequency) {
    case 'daily':
      return DAYS_PER_MONTH / interval;
    case 'weekly':
      return WEEKS_PER_MONTH / interval;
    case 'monthly':
      // Several patterns in a month, such as the 1st and the 15th
      return (date.patterns?.length || 1) / interval;
    case 'yearly':
      return 1 / (12 * interval);
    default:
      return null;
  }
}

export function monthlyCost(
  amount: number,
  date: RecurConfig | string,
): number | null {
  const times = chargesPerMonth(date);
  return times == null ? null : Math.round(Math.abs(amount) * times);
}
