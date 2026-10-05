import * as asyncStorage from '#platform/server/asyncStorage';
import { loadMappings } from '#server/db/mappings';
import { PostError } from '#server/errors';
import { post } from '#server/post';

import { app } from './app';

vi.mock('#server/post', () => ({ post: vi.fn() }));

const PIN = '9753';

const etf = {
  symbol: 'IE00TEST0001',
  name: 'Example World ETF',
  isin: 'IE00TEST0001',
  assetType: 'stock',
  currency: 'EUR',
  fxRate: null,
  priceSource: 'yahoo',
  priceSourceId: null,
};

const statement = {
  trades: [
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
      ...etf,
      importedId: 'tr:tx-sell-1',
      date: '2026-03-01',
      type: 'sell',
      quantity: 5,
      price: 110,
      fee: 1,
    },
    {
      ...etf,
      importedId: 'tr:tx-div-1',
      date: '2026-02-15',
      type: 'dividend',
      quantity: 1,
      price: 10,
      fee: 0,
    },
  ],
  skipped: { 'not executed': 1 },
};

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
  vi.mocked(asyncStorage.getItem).mockResolvedValue('token');
  vi.mocked(post).mockReset();
});

describe('investment-traderepublic-login', () => {
  it('passes the PIN to the sync server once and returns the handle', async () => {
    vi.mocked(post).mockResolvedValue({
      processId: 'handle',
      secondsToCode: 30,
    });

    const result = await app.handlers['investment-traderepublic-login']({
      phone: '+34600123456',
      pin: PIN,
    });

    expect(result).toEqual({
      processId: 'handle',
      secondsToCode: 30,
      error: null,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(post).mock.calls[0][0]).toBe(
      'https://test.env/brokers/traderepublic/login',
    );
  });

  it('answers errors with a fixed code that echoes nothing', async () => {
    vi.mocked(post).mockRejectedValue(new PostError('login-failed'));
    const failed = await app.handlers['investment-traderepublic-login']({
      phone: '+34600123456',
      pin: PIN,
    });
    expect(failed).toEqual({ error: 'login-failed' });

    // Anything unexpected, even a reason holding the input, is generic
    vi.mocked(post).mockRejectedValue(new PostError(`bad pin ${PIN}`));
    const odd = await app.handlers['investment-traderepublic-login']({
      phone: '+34600123456',
      pin: PIN,
    });
    expect(odd).toEqual({ error: 'unavailable' });
    expect(JSON.stringify([failed, odd])).not.toContain(PIN);
  });
});

describe('investment-traderepublic-import', () => {
  it('imports the trades and skips them when imported again', async () => {
    vi.mocked(post).mockResolvedValue(statement);

    const first = await app.handlers['investment-traderepublic-import']({
      processId: 'handle',
      code: '8642',
      accountId: 'broker-account',
    });
    expect(first).toEqual({
      imported: 3,
      duplicates: 0,
      assetsCreated: 1,
      skipped: { 'not executed': 1 },
      error: null,
    });

    const second = await app.handlers['investment-traderepublic-import']({
      processId: 'handle-2',
      code: '1357',
      accountId: 'broker-account',
    });
    expect(second).toMatchObject({
      imported: 0,
      duplicates: 3,
      assetsCreated: 0,
    });
    expect(await app.handlers['investment-trades-get']()).toHaveLength(3);
  });

  it('returns the reason when the code is wrong', async () => {
    vi.mocked(post).mockRejectedValue(new PostError('invalid-code'));
    const result = await app.handlers['investment-traderepublic-import']({
      processId: 'handle',
      code: '0000',
    });
    expect(result.error).toBe('invalid-code');
    expect(result.imported).toBe(0);
  });
});
