export type PerformancePoint = {
  date: string;
  // Market value of the portfolio on this day
  value: number;
  // Money put in (positive) or taken out (negative) since the previous
  // point, and income received in the same period
  flow: number;
  income: number;
};

// Time-weighted return in percent: flows are added to the start value of each period.
export function timeWeightedReturn(points: PerformancePoint[]): number | null {
  let growth = 1;
  let periods = 0;

  for (let i = 1; i < points.length; i++) {
    const invested = points[i - 1].value + points[i].flow;
    if (invested <= 0) {
      continue;
    }
    growth *= (points[i].value + points[i].income) / invested;
    periods++;
  }

  return periods === 0 ? null : (growth - 1) * 100;
}

export function returnCurve(
  points: PerformancePoint[],
): { date: string; value: number }[] {
  const curve: { date: string; value: number }[] = [];
  let growth = 1;

  for (let i = 1; i < points.length; i++) {
    const invested = points[i - 1].value + points[i].flow;
    if (invested <= 0) {
      continue;
    }
    if (curve.length === 0) {
      curve.push({ date: points[i - 1].date, value: 0 });
    }
    growth *= (points[i].value + points[i].income) / invested;
    curve.push({ date: points[i].date, value: (growth - 1) * 100 });
  }

  return curve;
}

export function sumByMonth(
  items: { date: string; amount: number }[],
): { month: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const month = item.date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + item.amount);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));
}
