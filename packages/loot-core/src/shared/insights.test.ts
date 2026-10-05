import { compareCategories, cumulativeSavings } from './insights';

describe('cumulativeSavings', () => {
  it('accumulates by month and computes the savings rate', () => {
    const result = cumulativeSavings([
      { month: '2026-02', income: 1000, expenses: 1200 },
      { month: '2026-01', income: 1000, expenses: 600 },
      { month: '2026-03', income: 0, expenses: 50 },
    ]);

    expect(result.map(r => r.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(result[0].savingsRate).toBeCloseTo(0.4);
    expect(result[1].savingsRate).toBeCloseTo(-0.2);
    expect(result[2].savingsRate).toBeNull();
    expect(result[2].cumulativeIncome).toBe(2000);
    expect(result[2].cumulativeExpenses).toBe(1850);
  });
});

describe('compareCategories', () => {
  it('compares both periods and sorts by the biggest change', () => {
    const result = compareCategories(
      [
        { name: 'Food', total: 300 },
        { name: 'Fun', total: 100 },
      ],
      [
        { name: 'Food', total: 200 },
        { name: 'Rent', total: 500 },
      ],
    );

    expect(result.map(r => r.name)).toEqual(['Rent', 'Food', 'Fun']);
    expect(result[0]).toMatchObject({ current: 0, previous: 500, change: -1 });
    expect(result[1].change).toBeCloseTo(0.5);
    expect(result[2].change).toBeNull();
  });
});
