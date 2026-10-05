import {
  returnCurve,
  sumByMonth,
  timeWeightedReturn,
} from './investment-performance';

const p = (date: string, value: number, flow = 0, income = 0) => ({
  date,
  value,
  flow,
  income,
});

describe('timeWeightedReturn', () => {
  it('ignores deposits', () => {
    // 100 -> 110 (+10%), then 100 is added and it grows 10% again
    const result = timeWeightedReturn([
      p('2026-01-01', 100),
      p('2026-02-01', 110),
      p('2026-03-01', 231, 100),
    ]);
    expect(result).toBeCloseTo(21, 5);
  });

  it('counts income as return', () => {
    expect(
      timeWeightedReturn([p('2026-01-01', 100), p('2026-02-01', 100, 0, 5)]),
    ).toBeCloseTo(5, 5);
  });

  it('is null without a funded period', () => {
    expect(timeWeightedReturn([p('2026-01-01', 0), p('2026-02-01', 0)])).toBe(
      null,
    );
    expect(timeWeightedReturn([])).toBe(null);
  });
});

describe('returnCurve', () => {
  it('starts at zero when money first goes in', () => {
    const curve = returnCurve([
      p('2026-01-01', 0),
      p('2026-02-01', 100, 100),
      p('2026-03-01', 120),
    ]);
    expect(curve.map(point => point.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(curve[1].value).toBeCloseTo(0, 5);
    expect(curve[2].value).toBeCloseTo(20, 5);
  });
});

describe('sumByMonth', () => {
  it('groups and sorts', () => {
    expect(
      sumByMonth([
        { date: '2026-03-02', amount: 2 },
        { date: '2026-01-10', amount: 1 },
        { date: '2026-03-20', amount: 3 },
      ]),
    ).toEqual([
      { month: '2026-01', amount: 1 },
      { month: '2026-03', amount: 5 },
    ]);
  });
});
