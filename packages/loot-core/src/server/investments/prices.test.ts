import * as asyncStorage from '#platform/server/asyncStorage';
import { loadMappings } from '#server/db/mappings';
import { post } from '#server/post';
import { setServer } from '#server/server-config';

import { app } from './app';

vi.mock('#server/post', () => ({ post: vi.fn() }));

const quotes = [
  { date: '2026-10-01', price: 169.38 },
  { date: '2026-10-02', price: 171.14 },
];

function createAsset(symbol: string, currency = 'EUR') {
  return app.handlers['investment-asset-create']({
    symbol,
    name: symbol,
    currency,
    price_source: 'yahoo',
    price_source_id: symbol,
  });
}

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
  vi.mocked(asyncStorage.getItem).mockResolvedValue('token');
  setServer('https://server.test/');
  vi.mocked(post).mockReset();
});

describe('investment-prices-refresh', () => {
  it('stores the prices and exchange rates the server returns', async () => {
    const asset_id = await createAsset('VWCE.DE');
    await app.handlers['investment-trade-create']({
      asset_id,
      date: '2026-01-10',
      type: 'buy',
      quantity: 10,
      price: 100,
    });
    vi.mocked(post)
      .mockResolvedValueOnce([{ currency: 'EUR', quotes }])
      .mockResolvedValueOnce([
        { base: 'EUR', quote: 'USD', date: '2026-10-02', rate: 1.1225 },
      ]);

    const result = await app.handlers['investment-prices-refresh']({ days: 3 });

    expect(result).toEqual({ updated: 1, fxRates: 1, errors: [] });
    expect(vi.mocked(post).mock.calls[0].slice(0, 3)).toEqual([
      'https://server.test/prices/quotes',
      {
        assets: [{ source: 'yahoo', id: 'VWCE.DE', currency: 'EUR' }],
        days: 3,
      },
      { 'X-ACTUAL-TOKEN': 'token' },
    ]);

    const [position] = await app.handlers['investment-positions-get']({
      baseCurrency: 'USD',
    });
    expect(position.price).toBe(171.14);
    expect(position.priceDate).toBe('2026-10-02');
  });

  it('asks for every day since the oldest missing price', async () => {
    // Tests run with a fixed "today" of 2017-01-01
    const traded = await createAsset('AAA');
    const priced = await createAsset('BBB');
    await app.handlers['investment-trade-create']({
      asset_id: traded,
      date: '2016-12-02',
      type: 'buy',
      quantity: 1,
      price: 100,
    });
    await app.handlers['investment-price-set']({
      assetId: priced,
      date: '2016-12-30',
      price: 50,
    });
    vi.mocked(post).mockResolvedValue([]);

    await app.handlers['investment-prices-refresh']();

    expect(vi.mocked(post).mock.calls[0][1]).toMatchObject({ days: 31 });
  });

  it('reports the assets that could not be priced', async () => {
    await createAsset('AAA');
    const mismatched = await createAsset('BBB');
    const failed = await createAsset('CCC');
    vi.mocked(post)
      .mockResolvedValueOnce([
        { currency: 'EUR', quotes },
        { currency: 'USD', quotes },
        { error: 'No data for this symbol' },
      ])
      .mockRejectedValueOnce(new Error('network-failure'));

    const result = await app.handlers['investment-prices-refresh']();

    expect(result.updated).toBe(1);
    expect(result.errors).toEqual([
      {
        assetId: mismatched,
        symbol: 'BBB',
        message: 'Quoted in USD, but the asset is in EUR',
      },
      { assetId: failed, symbol: 'CCC', message: 'No data for this symbol' },
      {
        assetId: null,
        symbol: null,
        message: 'Exchange rates: network-failure',
      },
    ]);
  });

  it('needs a sync server', async () => {
    vi.mocked(asyncStorage.getItem).mockResolvedValue(undefined);

    const result = await app.handlers['investment-prices-refresh']();

    expect(result.updated).toBe(0);
    expect(result.errors[0].message).toMatch(/sync server is needed/);
    expect(post).not.toHaveBeenCalled();
  });
});
