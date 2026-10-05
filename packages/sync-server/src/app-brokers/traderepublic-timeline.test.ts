import { downloadTimeline } from './traderepublic-client';
import { createFakeDeps, ETF_ISIN, STOCK_ISIN } from './traderepublic-fixtures';
import {
  needsDetail,
  parseDisplayNumber,
  parseTimeline,
} from './traderepublic-timeline';

describe('parseDisplayNumber', () => {
  it('reads amounts as the app shows them', () => {
    expect(parseDisplayNumber('€1,234.56')).toBe(1234.56);
    expect(parseDisplayNumber('1.234,56 €')).toBe(1234.56);
    expect(parseDisplayNumber('-€1.00')).toBe(-1);
    expect(parseDisplayNumber('0,5')).toBe(0.5);
    expect(parseDisplayNumber('1,000')).toBe(1000);
    expect(parseDisplayNumber('Free')).toBe(0);
    expect(parseDisplayNumber('n/a')).toBeNull();
  });
});

describe('parseTimeline', () => {
  async function parseFixture() {
    const { deps } = createFakeDeps();
    return parseTimeline(
      await downloadTimeline(deps, 'tr_session=x', needsDetail),
    );
  }

  const etf = {
    symbol: ETF_ISIN,
    name: 'Example World ETF',
    isin: ETF_ISIN,
    assetType: 'stock',
    currency: 'EUR',
    fxRate: null,
    priceSource: 'yahoo',
    priceSourceId: null,
  };
  const stock = { ...etf, symbol: STOCK_ISIN, isin: STOCK_ISIN };

  it('maps buys, sales, dividends, tax and interest', async () => {
    const { trades, skipped } = await parseFixture();
    expect(trades).toEqual([
      {
        ...etf,
        importedId: 'tr:tx-buy-1',
        date: '2026-01-10',
        type: 'buy',
        quantity: 10,
        price: 100,
        fee: 1,
      },
      {
        ...stock,
        name: 'Example Corp',
        importedId: 'tr:tx-div-1',
        date: '2026-02-15',
        type: 'dividend',
        quantity: 1,
        // What was paid plus the tax withheld
        price: 10,
        fee: 0,
      },
      {
        ...stock,
        name: 'Example Corp',
        importedId: 'tr:tx-div-1:tax',
        date: '2026-02-15',
        type: 'fee',
        quantity: 0,
        price: 0,
        fee: 1.5,
      },
      {
        ...etf,
        importedId: 'tr:tx-sell-1',
        date: '2026-03-01',
        type: 'sell',
        quantity: 5,
        // (548 received + 1 fee + 1 tax) / 5 shares
        price: 110,
        fee: 1,
      },
      {
        ...etf,
        importedId: 'tr:tx-sell-1:tax',
        date: '2026-03-01',
        type: 'fee',
        quantity: 0,
        price: 0,
        fee: 1,
      },
      {
        symbol: 'TR-INTEREST',
        name: 'Trade Republic interest',
        isin: null,
        assetType: 'other',
        currency: 'EUR',
        fxRate: null,
        priceSource: null,
        priceSourceId: null,
        importedId: 'tr:tx-interest-1',
        date: '2026-03-31',
        type: 'dividend',
        quantity: 1,
        price: 2.34,
        fee: 0,
      },
    ]);
    // Deposits are not investment events; cancelled orders are counted
    expect(skipped).toEqual({ 'not executed': 1 });
  });

  it('gives the same ids every time, so a repeat import adds nothing', async () => {
    const first = await parseFixture();
    const second = await parseFixture();
    expect(second.trades.map(t => t.importedId)).toEqual(
      first.trades.map(t => t.importedId),
    );
  });

  it('counts trades it cannot read instead of guessing', () => {
    const { trades, skipped } = parseTimeline([
      {
        item: {
          id: 'x',
          eventType: 'TRADE_INVOICE',
          status: 'EXECUTED',
          timestamp: '2026-01-01T00:00:00.000+0000',
          icon: `logos/${ETF_ISIN}/v2`,
          amount: { value: -10, currency: 'EUR' },
        },
        detail: null,
      },
      {
        item: {
          id: 'y',
          eventType: 'CREDIT',
          status: 'EXECUTED',
          timestamp: '2026-01-01T00:00:00.000+0000',
          amount: { value: 3, currency: 'EUR' },
        },
        detail: null,
      },
    ]);
    expect(trades).toEqual([]);
    expect(skipped).toEqual({
      'trade without shares': 1,
      'dividend without ISIN': 1,
    });
  });
});
