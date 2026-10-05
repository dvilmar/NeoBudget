import { buildDividendCalendar, shiftMonth } from './dividend-calendar';

const div = (
  asset_id: string,
  date: string,
  amount: number,
  fx: number | null = null,
) => ({
  asset_id,
  date,
  type: 'dividend',
  quantity: amount,
  price: 1,
  fee: 0,
  fx_rate: fx,
});

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', -12)).toBe('2025-12');
  });
});

describe('buildDividendCalendar', () => {
  const trades = [
    div('a', '2025-11-10', 10),
    div('a', '2026-02-10', 20, 2),
    div('b', '2025-12-05', 5),
    div('a', '2024-01-01', 99),
    { ...div('a', '2026-03-01', 50), type: 'buy' },
  ];

  it('lists 12 past months and the future ones', () => {
    const months = buildDividendCalendar(trades, '2026-10-15');
    expect(months).toHaveLength(15);
    expect(months[0].month).toBe('2025-11');
    expect(months[11].month).toBe('2026-10');
    expect(months[14].month).toBe('2027-01');
  });

  it('adds up received dividends with the exchange rate', () => {
    const months = buildDividendCalendar(trades, '2026-10-15');
    expect(months.find(m => m.month === '2025-11')?.received).toBe(10);
    expect(months.find(m => m.month === '2026-02')?.received).toBe(40);
    expect(months.find(m => m.month === '2026-03')?.received).toBe(0);
  });

  it('estimates by repeating the same month of the previous year', () => {
    const months = buildDividendCalendar(trades, '2026-10-15');
    expect(months.find(m => m.month === '2026-11')?.estimated).toBe(10);
    expect(months.find(m => m.month === '2026-12')?.estimated).toBe(5);
    expect(months.find(m => m.month === '2027-01')?.estimated).toBe(0);
  });

  it('ignores assets that are no longer held', () => {
    const months = buildDividendCalendar(trades, '2026-10-15', {
      activeAssetIds: new Set(['a']),
    });
    expect(months.find(m => m.month === '2026-12')?.estimated).toBe(0);
  });
});
