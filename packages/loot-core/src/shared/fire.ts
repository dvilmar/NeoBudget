export type FireInput = {
  // Everything in the same currency and the same unit
  annualExpenses: number;
  portfolio: number;
  annualSavings: number;
  // Yearly return after inflation, in percent
  realReturn: number;
  // Share of the portfolio that can be withdrawn each year, in percent
  withdrawalRate: number;
};

export type FireResult = {
  fireNumber: number;
  progress: number;
  // null when the target is not reached within the horizon
  yearsToFire: number | null;
};

const MAX_YEARS = 100;

export function computeFire(input: FireInput): FireResult {
  const { annualExpenses, portfolio, annualSavings, realReturn } = input;
  const fireNumber =
    input.withdrawalRate > 0
      ? annualExpenses / (input.withdrawalRate / 100)
      : Infinity;
  const progress =
    Number.isFinite(fireNumber) && fireNumber > 0
      ? Math.max(0, (portfolio / fireNumber) * 100)
      : 0;

  let yearsToFire: number | null = null;
  if (Number.isFinite(fireNumber)) {
    let value = portfolio;
    for (let year = 0; year <= MAX_YEARS; year++) {
      if (value >= fireNumber) {
        yearsToFire = year;
        break;
      }
      value = value * (1 + realReturn / 100) + annualSavings;
    }
  }

  return { fireNumber, progress, yearsToFire };
}

export function emergencyFund(monthlyExpenses: number, months: number) {
  return monthlyExpenses * months;
}
