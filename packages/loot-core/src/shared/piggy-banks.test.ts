import { computeProgress } from './piggy-banks';

const piggy = {
  id: 'p1',
  name: 'Holiday',
  target_amount: 100000,
  target_date: null,
  account_id: null,
  notes: null,
  sort_order: 1,
  group_name: null,
};

describe('computeProgress', () => {
  it('reports the percentage and caps it at 100', () => {
    expect(computeProgress(piggy, 25000, '2026-10-04').percent).toBe(25);
    expect(computeProgress(piggy, 150000, '2026-10-04').percent).toBe(100);
  });

  it('has no percentage without a target', () => {
    const result = computeProgress(
      { ...piggy, target_amount: 0 },
      500,
      '2026-10-04',
    );
    expect(result.percent).toBeNull();
  });

  it('spreads what is missing over the months left', () => {
    const result = computeProgress(
      { ...piggy, target_date: '2027-01-15' },
      40000,
      '2026-10-04',
    );
    // 60000 missing over October to January, 3 months
    expect(result.monthlyNeeded).toBe(20000);
  });

  it('needs no monthly amount when done or past the date', () => {
    expect(
      computeProgress(
        { ...piggy, target_date: '2027-01-15' },
        100000,
        '2026-10-04',
      ).monthlyNeeded,
    ).toBeNull();
    expect(
      computeProgress({ ...piggy, target_date: '2026-01-15' }, 0, '2026-10-04')
        .monthlyNeeded,
    ).toBeNull();
  });
});
