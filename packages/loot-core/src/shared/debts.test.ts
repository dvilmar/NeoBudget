import {
  amortizationSchedule,
  computeDebt,
  monthlyInterest,
  monthsToPayOff,
} from './debts';

const debt = {
  id: 'd1',
  name: 'Car loan',
  kind: 'loan' as const,
  direction: 'owed_by_me' as const,
  principal: 1200000,
  interest_rate: 6,
  start_date: null,
  monthly_payment: null,
  account_id: null,
  notes: null,
};

describe('debts', () => {
  it('takes only the principal part of the payments off the balance', () => {
    const result = computeDebt(debt, [
      { amount: 30000, interest: 6000 },
      { amount: 30000, interest: 5880 },
    ]);

    expect(result.paid).toBe(60000);
    expect(result.interestPaid).toBe(11880);
    expect(result.outstanding).toBe(1200000 - 48120);
    expect(result.percent).toBeCloseTo(4.01, 2);
  });

  it('never goes below zero', () => {
    const result = computeDebt(debt, [{ amount: 2000000, interest: 0 }]);
    expect(result.outstanding).toBe(0);
    expect(result.percent).toBe(100);
  });

  it('estimates the interest of the next month', () => {
    expect(monthlyInterest(1200000, 6)).toBe(6000);
    expect(monthlyInterest(1200000, 0)).toBe(0);
  });

  it('computes the months left with and without interest', () => {
    expect(monthsToPayOff(120000, 0, 10000)).toBe(12);
    // 10000 at 12% a year with 1000 a month takes a bit over 11 months
    expect(monthsToPayOff(10000, 12, 1000)).toBe(11);
    expect(monthsToPayOff(0, 5, 100)).toBe(0);
  });

  it('has no answer when the payment does not cover the interest', () => {
    expect(monthsToPayOff(1200000, 6, 5000)).toBeNull();
    expect(monthsToPayOff(1200000, 6, 0)).toBeNull();
  });

  it('uses the monthly payment of the debt', () => {
    const result = computeDebt({ ...debt, monthly_payment: 100000 }, []);
    expect(result.monthsLeft).toBe(13);
  });
});

describe('amortizationSchedule', () => {
  it('pays off the balance and ends with a smaller payment', () => {
    const rows = amortizationSchedule(1000, 0, 400);
    expect(rows.map(row => row.payment)).toEqual([400, 400, 200]);
    expect(rows[rows.length - 1].balance).toBe(0);
  });

  it('splits interest and principal', () => {
    const [first] = amortizationSchedule(120000, 12, 20000);
    expect(first.interest).toBe(1200);
    expect(first.principal).toBe(18800);
    expect(first.balance).toBe(101200);
  });

  it('is empty when the payment never covers the interest', () => {
    expect(amortizationSchedule(100000, 12, 500)).toEqual([]);
    expect(amortizationSchedule(0, 5, 100)).toEqual([]);
  });
});
