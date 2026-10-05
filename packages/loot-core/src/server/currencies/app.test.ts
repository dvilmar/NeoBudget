import { loadMappings } from '#server/db/mappings';
import { app as investmentsApp } from '#server/investments/app';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

describe('currencies app', () => {
  it('stores, changes and clears the currency of an account', async () => {
    await app.handlers['account-currency-set']({
      accountId: 'a1',
      currency: 'usd',
    });
    expect(await app.handlers['account-currencies-get']()).toEqual({
      a1: 'USD',
    });

    await app.handlers['account-currency-set']({
      accountId: 'a1',
      currency: 'GBP',
    });
    expect(await app.handlers['account-currencies-get']()).toEqual({
      a1: 'GBP',
    });

    await app.handlers['account-currency-set']({
      accountId: 'a1',
      currency: null,
    });
    expect(await app.handlers['account-currencies-get']()).toEqual({});
  });

  it('rejects something that is not a currency code', async () => {
    await expect(
      app.handlers['account-currency-set']({
        accountId: 'a1',
        currency: 'dollars!',
      }),
    ).rejects.toThrow('currency code');
  });

  it('gives the rates to the base currency, or null when unknown', async () => {
    await investmentsApp.handlers['investment-fx-rate-set']({
      base: 'EUR',
      quote: 'USD',
      date: '2026-03-01',
      rate: 1.25,
    });

    const rates = await app.handlers['fx-rates-get']({
      base: 'eur',
      currencies: ['usd', 'EUR', 'JPY'],
    });
    expect(rates.EUR).toBe(1);
    expect(rates.USD).toBeCloseTo(1 / 1.25);
    expect(rates.JPY).toBeNull();
  });
});
