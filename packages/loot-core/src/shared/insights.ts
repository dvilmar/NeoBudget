export type MonthIncomeExpenses = {
  month: string;
  income: number;
  expenses: number;
};

export type CumulativeMonth = MonthIncomeExpenses & {
  cumulativeIncome: number;
  cumulativeExpenses: number;
  // (income - expenses) / income for that month, null without income
  savingsRate: number | null;
};

export function cumulativeSavings(
  months: MonthIncomeExpenses[],
): CumulativeMonth[] {
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;
  return [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(month => {
      cumulativeIncome += month.income;
      cumulativeExpenses += month.expenses;
      return {
        ...month,
        cumulativeIncome,
        cumulativeExpenses,
        savingsRate:
          month.income > 0
            ? (month.income - month.expenses) / month.income
            : null,
      };
    });
}

export type CategoryComparison = {
  name: string;
  current: number;
  previous: number;
  difference: number;
  // Change against the previous period, null when it had nothing
  change: number | null;
};

// A category missing from one side counts as zero there.
export function compareCategories(
  current: { name: string; total: number }[],
  previous: { name: string; total: number }[],
): CategoryComparison[] {
  const names = new Set([...current, ...previous].map(row => row.name));
  const find = (rows: { name: string; total: number }[], name: string) =>
    rows.find(row => row.name === name)?.total ?? 0;

  return [...names]
    .map(name => {
      const now = find(current, name);
      const before = find(previous, name);
      return {
        name,
        current: now,
        previous: before,
        difference: now - before,
        change: before > 0 ? (now - before) / before : null,
      };
    })
    .sort(
      (a, b) =>
        Math.abs(b.difference) - Math.abs(a.difference) ||
        a.name.localeCompare(b.name),
    );
}
