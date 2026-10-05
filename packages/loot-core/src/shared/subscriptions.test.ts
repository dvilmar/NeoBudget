import { chargesPerMonth, monthlyCost } from './subscriptions';

const start = '2026-01-01';

describe('subscription costs', () => {
  it('counts the charges of each frequency in a month', () => {
    expect(chargesPerMonth({ frequency: 'monthly', start })).toBe(1);
    expect(
      chargesPerMonth({ frequency: 'monthly', interval: 3, start }),
    ).toBeCloseTo(1 / 3);
    expect(chargesPerMonth({ frequency: 'yearly', start })).toBeCloseTo(1 / 12);
    expect(chargesPerMonth({ frequency: 'weekly', start })).toBeCloseTo(
      4.333,
      3,
    );
    expect(chargesPerMonth({ frequency: 'daily', start })).toBeCloseTo(
      30.417,
      3,
    );
  });

  it('counts every pattern of a month', () => {
    expect(
      chargesPerMonth({
        frequency: 'monthly',
        start,
        patterns: [
          { value: 1, type: 'day' },
          { value: 15, type: 'day' },
        ],
      }),
    ).toBe(2);
  });

  it('has no monthly cost for a single date', () => {
    expect(chargesPerMonth('2026-05-01')).toBeNull();
    expect(monthlyCost(1000, '2026-05-01')).toBeNull();
  });

  it('turns an amount into a monthly cost, ignoring the sign', () => {
    expect(monthlyCost(-1200, { frequency: 'yearly', start })).toBe(100);
    expect(monthlyCost(-999, { frequency: 'monthly', start })).toBe(999);
  });
});
