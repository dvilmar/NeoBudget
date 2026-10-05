import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';

import { aqlQuery } from '#queries/aqlQuery';

export type Range =
  | 'month'
  | 'lastMonth'
  | 'year'
  | 'lastYear'
  | 'all'
  // custom:2026-01-01:2026-03-31
  | `custom:${string}:${string}`;
export type Kind = 'expenses' | 'income';
export type GroupBy = 'category' | 'payee' | 'account';

export type Total = { name: string; total: number };
export type MonthTotal = { month: string; income: number; expenses: number };

// `offset` moves a month or year range back (negative) or forward in time
export function rangeDates(
  range: Range,
  offset = 0,
): { start: string; end: string } {
  if (range.startsWith('custom:')) {
    const [, start, end] = range.split(':');
    return { start, end };
  }
  const month = monthUtils.addMonths(monthUtils.currentMonth(), offset);
  const year = String(Number(monthUtils.currentMonth().slice(0, 4)) + offset);
  switch (range) {
    case 'month':
      return {
        start: monthUtils.firstDayOfMonth(month),
        end: monthUtils.lastDayOfMonth(month),
      };
    case 'lastMonth': {
      const last = monthUtils.prevMonth(month);
      return {
        start: monthUtils.firstDayOfMonth(last),
        end: monthUtils.lastDayOfMonth(last),
      };
    }
    case 'year':
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    case 'lastYear':
      return {
        start: `${Number(year) - 1}-01-01`,
        end: `${Number(year) - 1}-12-31`,
      };
    default:
      return { start: '1900-01-01', end: '2999-12-31' };
  }
}

const GROUP_FIELD: Record<GroupBy, string> = {
  category: 'category.name',
  payee: 'payee.name',
  account: 'account.name',
};

// Money moving between the user's own accounts is not spending or income
const notATransfer = { 'payee.transfer_acct': null };

export async function getBreakdown(
  range: Range,
  offset: number,
  kind: Kind,
  groupBy: GroupBy,
): Promise<Total[]> {
  const { start, end } = rangeDates(range, offset);
  const field = GROUP_FIELD[groupBy];

  const { data } = await aqlQuery(
    q('transactions')
      .filter({
        date: { $gte: start, $lte: end },
        amount: kind === 'expenses' ? { $lt: 0 } : { $gt: 0 },
        ...notATransfer,
      })
      .groupBy(field)
      .select([field, { total: { $sum: '$amount' } }]),
  );

  return (data as Record<string, unknown>[])
    .map(row => ({
      name: String(row[field] ?? ''),
      total: Math.abs(Number(row.total ?? 0)),
    }))
    .filter(row => row.name !== '' && row.total > 0)
    .sort((a, b) => b.total - a.total);
}

export async function getMonthly(
  range: Range,
  offset: number,
): Promise<MonthTotal[]> {
  const { start, end } = rangeDates(range, offset);

  const split = async (direction: 'income' | 'expenses') => {
    const { data: rows } = await aqlQuery(
      q('transactions')
        .filter({
          date: { $gte: start, $lte: end },
          amount: direction === 'income' ? { $gt: 0 } : { $lt: 0 },
          ...notATransfer,
        })
        .groupBy({ $month: '$date' })
        .select([
          { month: { $month: '$date' } },
          { total: { $sum: '$amount' } },
        ]),
    );
    return new Map(
      (rows as Record<string, unknown>[]).map(row => [
        String(row.month),
        Math.abs(Number(row.total ?? 0)),
      ]),
    );
  };

  const income = await split('income');
  const expenses = await split('expenses');
  const months = [...new Set([...income.keys(), ...expenses.keys()])].sort();

  return months.map(month => ({
    month,
    income: income.get(month) ?? 0,
    expenses: expenses.get(month) ?? 0,
  }));
}
