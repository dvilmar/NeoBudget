import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { currentDay, subDays } from '#shared/months';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

function createAsset(currency = 'EUR') {
  return app.handlers['investment-asset-create']({
    symbol: 'VWCE',
    name: 'Vanguard FTSE All-World',
    type: 'etf',
    currency,
  });
}

describe('investments app', () => {
  it('creates, updates and lists assets', async () => {
    const id = await app.handlers['investment-asset-create']({
      symbol: 'BTC',
      name: 'Bitcoin',
      currency: 'usd',
    });
    await app.handlers['investment-asset-update']({ id, type: 'crypto' });

    expect(await app.handlers['investment-assets-get']()).toEqual([
      {
        id,
        symbol: 'BTC',
        name: 'Bitcoin',
        type: 'crypto',
        currency: 'USD',
        isin: null,
        price_source: null,
        price_source_id: null,
        watched: 0,
      },
    ]);
  });

  it('imports a watchlist and exports it', async () => {
    const first = await app.handlers['investment-watchlist-import']({
      text: 'aapl\nmsft',
    });
    expect(first).toEqual({ added: 2, existing: 0 });
    const again = await app.handlers['investment-watchlist-import']({
      text: 'AAPL',
    });
    expect(again).toEqual({ added: 0, existing: 1 });

    const csv = await app.handlers['investment-export-csv']({
      kind: 'watchlist',
    });
    expect(csv).toBe(
      'symbol,name,type,currency\nAAPL,AAPL,stock,EUR\nMSFT,MSFT,stock,EUR',
    );
  });

  it('rejects invalid assets and trades', async () => {
    await expect(
      // @ts-expect-error the currency is missing on purpose
      app.handlers['investment-asset-create']({ symbol: 'X', name: 'X' }),
    ).rejects.toThrow(/missing field currency/);

    const asset_id = await createAsset();
    await expect(
      app.handlers['investment-trade-create']({
        asset_id,
        date: '2026-01-10',
        type: 'buy',
        quantity: -1,
        price: 100,
      }),
    ).rejects.toThrow(/quantity/);
  });

  it('does not import the same broker trade twice', async () => {
    const asset_id = await createAsset();
    const trade = {
      asset_id,
      account_id: 'broker',
      date: '2026-01-10',
      type: 'buy' as const,
      quantity: 1,
      price: 100,
      imported_id: 'T-1',
    };

    const first = await app.handlers['investment-trade-create'](trade);
    const second = await app.handlers['investment-trade-create'](trade);

    expect(second).toBe(first);
    expect(await app.handlers['investment-trades-get']()).toHaveLength(1);
  });

  it('deletes the trades of a deleted asset', async () => {
    const asset_id = await createAsset();
    await app.handlers['investment-trade-create']({
      asset_id,
      date: '2026-01-10',
      type: 'buy',
      quantity: 1,
      price: 100,
    });

    await app.handlers['investment-asset-delete']({ id: asset_id });

    expect(await app.handlers['investment-assets-get']()).toEqual([]);
    expect(await app.handlers['investment-trades-get']()).toEqual([]);
    const rows = await db.all<{ tombstone: number }>(
      'SELECT tombstone FROM investment_trades',
    );
    expect(rows).toEqual([{ tombstone: 1 }]);
  });

  it('values positions with the latest price', async () => {
    const asset_id = await createAsset();
    await app.handlers['investment-trade-create']({
      asset_id,
      date: '2026-01-10',
      type: 'buy',
      quantity: 10,
      price: 100,
      fee: 5,
    });
    await app.handlers['investment-price-set']({
      assetId: asset_id,
      date: '2026-02-01',
      price: 105,
    });
    await app.handlers['investment-price-set']({
      assetId: asset_id,
      date: '2026-03-01',
      price: 120,
    });

    const [position] = await app.handlers['investment-positions-get']();

    expect(position.asset.id).toBe(asset_id);
    expect(position.quantity).toBe(10);
    expect(position.costBasis).toBe(1005);
    expect(position.price).toBe(120);
    expect(position.priceDate).toBe('2026-03-01');
    expect(position.marketValue).toBe(1200);
    expect(position.unrealizedGain).toBe(195);
    expect(position.base).toBeNull();
  });

  it('returns the saved prices of an asset within the window', async () => {
    const assetId = await createAsset();
    const other = await createAsset();
    const today = currentDay();
    for (const [id, date, price] of [
      [assetId, subDays(today, 200), 90],
      [assetId, subDays(today, 10), 100],
      [assetId, subDays(today, 5), 110],
      [other, subDays(today, 5), 7],
    ] as const) {
      await app.handlers['investment-price-set']({ assetId: id, date, price });
    }

    expect(
      await app.handlers['investment-price-history']({ assetId, days: 30 }),
    ).toEqual([
      { date: subDays(today, 10), price: 100 },
      { date: subDays(today, 5), price: 110 },
    ]);
  });

  it('filters positions by account', async () => {
    const asset_id = await createAsset();
    for (const account_id of ['a', 'b']) {
      await app.handlers['investment-trade-create']({
        asset_id,
        account_id,
        date: '2026-01-10',
        type: 'buy',
        quantity: 1,
        price: 100,
      });
    }

    const [all] = await app.handlers['investment-positions-get']();
    const [onlyA] = await app.handlers['investment-positions-get']({
      accountId: 'a',
    });

    expect(all.quantity).toBe(2);
    expect(onlyA.quantity).toBe(1);
  });

  it('converts positions to the base currency', async () => {
    const asset_id = await createAsset('USD');
    // The broker rate on the trade wins over the stored daily rate
    await app.handlers['investment-trade-create']({
      asset_id,
      date: '2026-01-10',
      type: 'buy',
      quantity: 10,
      price: 100,
      fx_rate: 0.9,
    });
    await app.handlers['investment-price-set']({
      assetId: asset_id,
      date: '2026-03-01',
      price: 110,
    });
    // Stored the other way round: 1 EUR = 1.25 USD, so 1 USD = 0.8 EUR
    await app.handlers['investment-fx-rate-set']({
      base: 'EUR',
      quote: 'USD',
      date: '2026-03-01',
      rate: 1.25,
    });

    const [position] = await app.handlers['investment-positions-get']({
      baseCurrency: 'eur',
    });

    expect(position.unrealizedGain).toBe(100);
    expect(position.base?.currency).toBe('EUR');
    expect(position.base?.costBasis).toBeCloseTo(900);
    expect(position.base?.marketValue).toBeCloseTo(880);
    expect(position.base?.unrealizedGain).toBeCloseTo(-20);
  });

  it('leaves the base figures empty when a rate is missing', async () => {
    const asset_id = await createAsset('USD');
    await app.handlers['investment-trade-create']({
      asset_id,
      date: '2026-01-10',
      type: 'buy',
      quantity: 10,
      price: 100,
    });

    const [position] = await app.handlers['investment-positions-get']({
      baseCurrency: 'EUR',
    });

    expect(position.base).toBeNull();
  });

  it('builds the value history of the portfolio', async () => {
    const asset_id = await createAsset('EUR');
    await app.handlers['investment-trade-create']({
      asset_id,
      date: '2000-01-01',
      type: 'buy',
      quantity: 2,
      price: 10,
    });
    await app.handlers['investment-price-set']({
      assetId: asset_id,
      date: '2000-01-02',
      price: 15,
    });

    const history = await app.handlers['investment-value-history']({
      baseCurrency: 'EUR',
      days: 30,
      points: 4,
    });

    expect(history.length).toBeGreaterThan(1);
    expect(history.every(point => point.value === 30)).toBe(true);
  });

  it('imports a CSV once and skips it the second time', async () => {
    const text = [
      'date,type,symbol,quantity,price,currency',
      '2026-01-10,buy,VWCE.DE,2,100,EUR',
      '2026-02-10,sell,VWCE.DE,1,110,EUR',
      'broken,buy,VWCE.DE,1,1,EUR',
    ].join('\n');

    const first = await app.handlers['investment-import-csv']({ text });
    expect(first).toMatchObject({
      imported: 2,
      duplicates: 0,
      assetsCreated: 1,
    });
    expect(first.rejected).toHaveLength(1);

    const second = await app.handlers['investment-import-csv']({ text });
    expect(second).toMatchObject({ imported: 0, duplicates: 2 });

    const [position] = await app.handlers['investment-positions-get']();
    expect(position.quantity).toBe(1);
  });
});
