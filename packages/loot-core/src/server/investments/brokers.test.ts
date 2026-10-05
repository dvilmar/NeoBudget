import * as asyncStorage from '#platform/server/asyncStorage';
import { loadMappings } from '#server/db/mappings';
import { post } from '#server/post';

import { app } from './app';

vi.mock('#server/post', () => ({ post: vi.fn() }));

const vwce = {
  symbol: 'VWCE',
  name: 'VANG FTSE AW USDA',
  isin: 'IE00BK5BQT80',
  assetType: 'etf',
  currency: 'EUR',
  fxRate: 1,
  priceSource: 'yahoo',
  priceSourceId: 'VWCE.DE',
};

const statement = {
  trades: [
    {
      ...vwce,
      importedId: 'ibkr:1',
      date: '2026-01-15',
      type: 'buy',
      quantity: 10,
      price: 150,
      fee: 1,
    },
    {
      ...vwce,
      importedId: 'ibkr:2',
      date: '2026-02-15',
      type: 'buy',
      quantity: 5,
      price: 160,
      fee: 1,
    },
  ],
  skipped: { CASH: 1 },
};

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
  vi.mocked(asyncStorage.getItem).mockResolvedValue('token');
  vi.mocked(post).mockReset();
});

describe('investment-broker-sync', () => {
  it('creates the assets and trades the broker reports', async () => {
    vi.mocked(post).mockResolvedValue(statement);

    const result = await app.handlers['investment-broker-sync']({
      broker: 'ibkr',
      accountId: 'broker-account',
    });

    expect(result).toEqual({
      imported: 2,
      duplicates: 0,
      assetsCreated: 1,
      skipped: { CASH: 1 },
      error: null,
    });
    expect(vi.mocked(post).mock.calls[0][0]).toBe(
      'https://test.env/brokers/ibkr/trades',
    );

    const [asset] = await app.handlers['investment-assets-get']();
    expect(asset).toMatchObject({
      symbol: 'VWCE',
      type: 'etf',
      isin: 'IE00BK5BQT80',
      price_source: 'yahoo',
      price_source_id: 'VWCE.DE',
    });
    const [position] = await app.handlers['investment-positions-get']({
      accountId: 'broker-account',
    });
    expect(position.quantity).toBe(15);
    expect(position.costBasis).toBe(2302);
  });

  it('adds nothing when the same statement is imported again', async () => {
    vi.mocked(post).mockResolvedValue(statement);
    await app.handlers['investment-broker-sync']({ broker: 'ibkr' });

    const result = await app.handlers['investment-broker-sync']({
      broker: 'ibkr',
    });

    expect(result).toMatchObject({
      imported: 0,
      duplicates: 2,
      assetsCreated: 0,
    });
    expect(await app.handlers['investment-trades-get']()).toHaveLength(2);
  });

  it('reuses an asset that was added by hand', async () => {
    const id = await app.handlers['investment-asset-create']({
      symbol: 'VWCE.DE',
      name: 'Vanguard All-World',
      currency: 'EUR',
      isin: 'IE00BK5BQT80',
    });
    vi.mocked(post).mockResolvedValue(statement);

    const result = await app.handlers['investment-broker-sync']({
      broker: 'ibkr',
    });

    expect(result.assetsCreated).toBe(0);
    const trades = await app.handlers['investment-trades-get']();
    expect(trades.every(trade => trade.asset_id === id)).toBe(true);
  });

  it('returns the reason when the broker cannot be reached', async () => {
    vi.mocked(post).mockRejectedValue({ reason: 'Token is invalid.' });

    const result = await app.handlers['investment-broker-sync']({
      broker: 'ibkr',
    });

    expect(result).toMatchObject({ imported: 0, error: 'Token is invalid.' });
  });
});
