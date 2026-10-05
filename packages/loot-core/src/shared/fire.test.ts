import { computeFire, emergencyFund } from './fire';

describe('computeFire', () => {
  it('uses the withdrawal rate for the target', () => {
    const result = computeFire({
      annualExpenses: 20000,
      portfolio: 250000,
      annualSavings: 10000,
      realReturn: 0,
      withdrawalRate: 4,
    });
    expect(result.fireNumber).toBe(500000);
    expect(result.progress).toBe(50);
    expect(result.yearsToFire).toBe(25);
  });

  it('is already there when the portfolio covers it', () => {
    expect(
      computeFire({
        annualExpenses: 10000,
        portfolio: 300000,
        annualSavings: 0,
        realReturn: 0,
        withdrawalRate: 4,
      }).yearsToFire,
    ).toBe(0);
  });

  it('returns null when it is never reached', () => {
    expect(
      computeFire({
        annualExpenses: 20000,
        portfolio: 0,
        annualSavings: 0,
        realReturn: 0,
        withdrawalRate: 4,
      }).yearsToFire,
    ).toBe(null);
  });

  it('copes with a zero withdrawal rate', () => {
    const result = computeFire({
      annualExpenses: 1,
      portfolio: 1,
      annualSavings: 1,
      realReturn: 1,
      withdrawalRate: 0,
    });
    expect(result.yearsToFire).toBe(null);
    expect(result.progress).toBe(0);
  });
});

describe('emergencyFund', () => {
  it('multiplies months of expenses', () => {
    expect(emergencyFund(1500, 6)).toBe(9000);
  });
});
