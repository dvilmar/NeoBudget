import type { PiggyBankEntity, PiggyBankProgress } from '#types/models';

import { differenceInCalendarMonths } from './months';

export function computeProgress(
  piggy: PiggyBankEntity,
  saved: number,
  today: string,
): PiggyBankProgress {
  const missing = Math.max(piggy.target_amount - saved, 0);

  let monthlyNeeded: number | null = null;
  if (missing > 0 && piggy.target_date && piggy.target_date > today) {
    // The current month counts, so a target next month still needs one
    // payment
    const months = Math.max(
      differenceInCalendarMonths(piggy.target_date, today),
      1,
    );
    monthlyNeeded = Math.ceil(missing / months);
  }

  return {
    ...piggy,
    saved,
    percent:
      piggy.target_amount > 0
        ? Math.min((saved / piggy.target_amount) * 100, 100)
        : null,
    monthlyNeeded,
  };
}
