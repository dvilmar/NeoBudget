import {
  computePosition,
  computePositionFifo,
  valuePosition,
} from './investments';

const trades = [
  { date: '2026-01-10', type: 'buy', quantity: 10, price: 100, fee: 5 },
  { date: '2026-02-10', type: 'buy', quantity: 10, price: 120, fee: 5 },
  { date: '2026-03-10', type: 'sell', quantity: 5, price: 150, fee: 2 },
  { date: '2026-04-10', type: 'dividend', quantity: 15, price: 1, fee: 0 },
] as const;

describe('computePosition', () => {
  it('uses the average cost of the units held', () => {
    const position = computePosition([...trades]);

    expect(position.quantity).toBe(15);
    expect(position.costBasis).toBeCloseTo(1657.5);
    expect(position.averageCost).toBeCloseTo(110.5);
    expect(position.realizedGain).toBeCloseTo(195.5);
    expect(position.income).toBe(15);
    expect(position.fees).toBe(12);
  });

  it('does not depend on the order of the trades', () => {
    expect(computePosition([...trades].reverse())).toEqual(
      computePosition([...trades]),
    );
  });

  it('applies a same-day buy before the sell', () => {
    const position = computePosition([
      { date: '2026-01-10', type: 'sell', quantity: 2, price: 12, fee: 0 },
      { date: '2026-01-10', type: 'buy', quantity: 2, price: 10, fee: 0 },
    ]);

    expect(position.quantity).toBe(0);
    expect(position.realizedGain).toBe(4);
  });

  it('leaves no cost behind when the position is closed', () => {
    const position = computePosition([
      { date: '2026-01-10', type: 'buy', quantity: 0.1, price: 100, fee: 0 },
      { date: '2026-01-11', type: 'buy', quantity: 0.2, price: 100, fee: 0 },
      { date: '2026-01-12', type: 'sell', quantity: 0.3, price: 110, fee: 0 },
    ]);

    expect(position.quantity).toBe(0);
    expect(position.costBasis).toBe(0);
    expect(position.averageCost).toBe(0);
    expect(position.realizedGain).toBeCloseTo(3);
  });

  it('converts each trade with its own exchange rate', () => {
    const position = computePosition(
      [
        { date: '2026-01-10', type: 'buy', quantity: 10, price: 100, fee: 0 },
        { date: '2026-02-10', type: 'sell', quantity: 10, price: 100, fee: 0 },
      ],
      trade => (trade.type === 'buy' ? 0.9 : 0.8),
    );

    expect(position.realizedGain).toBeCloseTo(-100);
  });
});

describe('valuePosition', () => {
  it('values the units held at the given price', () => {
    const valuation = valuePosition(computePosition([...trades]), {
      price: 130,
      date: '2026-05-01',
    });

    expect(valuation.marketValue).toBe(1950);
    expect(valuation.unrealizedGain).toBeCloseTo(292.5);
    expect(valuation.unrealizedGainPercent).toBeCloseTo(17.647, 3);
    expect(valuation.priceDate).toBe('2026-05-01');
  });

  it('returns nulls when there is no price', () => {
    expect(valuePosition(computePosition([...trades]), null)).toEqual({
      price: null,
      priceDate: null,
      marketValue: null,
      unrealizedGain: null,
      unrealizedGainPercent: null,
    });
  });
});

describe('computePositionFifo', () => {
  it('sells the oldest lots first', () => {
    const position = computePositionFifo([...trades]);

    // Sold 5 of the first lot: cost 5 * 100.5 = 502.5, proceeds 748
    expect(position.realizedGain).toBeCloseTo(245.5);
    expect(position.quantity).toBe(15);
    // 5 left of lot 1 (502.5) + lot 2 (1205)
    expect(position.costBasis).toBeCloseTo(1707.5);
    expect(position.averageCost).toBeCloseTo(1707.5 / 15);
    expect(position.income).toBe(15);
    expect(position.fees).toBe(12);
  });

  it('spans several lots in one sell', () => {
    const position = computePositionFifo([
      { date: '2026-01-01', type: 'buy', quantity: 2, price: 10, fee: 0 },
      { date: '2026-01-02', type: 'buy', quantity: 2, price: 20, fee: 0 },
      { date: '2026-01-03', type: 'sell', quantity: 3, price: 30, fee: 0 },
    ]);

    expect(position.realizedGain).toBeCloseTo(90 - (20 + 20));
    expect(position.quantity).toBe(1);
    expect(position.costBasis).toBeCloseTo(20);
  });

  it('matches the average cost method when every buy has the same price', () => {
    const same = [
      { date: '2026-01-01', type: 'buy', quantity: 4, price: 10, fee: 0 },
      { date: '2026-01-02', type: 'buy', quantity: 4, price: 10, fee: 0 },
      { date: '2026-01-03', type: 'sell', quantity: 5, price: 12, fee: 1 },
    ] as const;
    expect(computePositionFifo([...same])).toEqual(computePosition([...same]));
  });

  it('does not change the average cost result', () => {
    expect(computePosition([...trades]).realizedGain).toBeCloseTo(195.5);
  });
});
