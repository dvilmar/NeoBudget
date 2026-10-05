import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { setFxRates } from '#server/investments/db';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

async function createTransaction(amount: number) {
  const account = await db.insertAccount({ name: 'Bank' });
  return db.insertTransaction({
    account,
    date: '2026-03-01',
    amount,
    notes: 'Lunch',
  });
}

describe('foreign amounts', () => {
  it('suggests the amount at the rate of the day', async () => {
    const transactionId = await createTransaction(-9000);
    expect(
      await app.handlers['tx-fx-suggest']({
        transactionId,
        currency: 'USD',
        baseCurrency: 'EUR',
      }),
    ).toBeNull();

    await setFxRates([
      { base: 'USD', quote: 'EUR', date: '2026-02-27', rate: 0.9 },
    ]);
    const suggestion = await app.handlers['tx-fx-suggest']({
      transactionId,
      currency: 'usd',
      baseCurrency: 'eur',
    });
    expect(suggestion).toMatchObject({ rate: 0.9, amount: 10000 });
  });

  it('works out the rate from the transaction and replaces it on a second set', async () => {
    const transactionId = await createTransaction(-9000);
    await app.handlers['tx-fx-set']({
      transactionId,
      currency: 'usd',
      amount: -10000,
    });

    const fx = await app.handlers['tx-fx-get']({ transactionId });
    expect(fx?.currency).toBe('USD');
    expect(fx?.rate).toBeCloseTo(0.9);

    await app.handlers['tx-fx-set']({
      transactionId,
      currency: 'GBP',
      amount: -7000,
    });
    expect((await app.handlers['tx-fx-get']({ transactionId }))?.currency).toBe(
      'GBP',
    );

    await app.handlers['tx-fx-clear']({ transactionId });
    expect(await app.handlers['tx-fx-get']({ transactionId })).toBeNull();
  });

  it('rejects bad input', async () => {
    const transactionId = await createTransaction(-100);
    await expect(
      app.handlers['tx-fx-set']({ transactionId, currency: 'x', amount: -1 }),
    ).rejects.toThrow('currency code');
    await expect(
      app.handlers['tx-fx-set']({ transactionId, currency: 'USD', amount: 0 }),
    ).rejects.toThrow();
    await expect(
      app.handlers['tx-fx-set']({
        transactionId: 'missing',
        currency: 'USD',
        amount: -5,
      }),
    ).rejects.toThrow('does not exist');
  });
});

describe('transaction links', () => {
  it('links two transactions once and shows the other side from both', async () => {
    const a = await createTransaction(-5000);
    const b = await db.insertTransaction({
      account: (await db.first<{ id: string }>('SELECT id FROM accounts'))!.id,
      date: '2026-03-05',
      amount: 5000,
      notes: 'Refund',
    });

    const id = await app.handlers['tx-link-create']({ a, b, type: 'refund' });
    expect(await app.handlers['tx-link-create']({ a: b, b: a })).toBe(id);

    const fromA = await app.handlers['tx-links-get']({ transactionId: a });
    expect(fromA).toHaveLength(1);
    expect(fromA[0].other).toMatchObject({
      id: b,
      amount: 5000,
      date: '2026-03-05',
    });
    expect(
      (await app.handlers['tx-links-get']({ transactionId: b }))[0].other?.id,
    ).toBe(a);

    await app.handlers['tx-link-delete']({ id });
    expect(await app.handlers['tx-links-get']({ transactionId: a })).toEqual(
      [],
    );
  });

  it('rejects a link to itself or of an unknown type', async () => {
    const a = await createTransaction(-1);
    await expect(app.handlers['tx-link-create']({ a, b: a })).rejects.toThrow();
    await expect(
      app.handlers['tx-link-create']({ a, b: 'x', type: 'gift' as never }),
    ).rejects.toThrow('Unknown link type');
  });
});

describe('attachments and the activity log', () => {
  it('needs a sync server for attachments', async () => {
    const transactionId = await createTransaction(-1);
    await expect(
      app.handlers['tx-attachment-add']({
        transactionId,
        name: 'receipt.pdf',
        mime: 'application/pdf',
        data: 'AAAA',
      }),
    ).rejects.toThrow();
    expect(await app.handlers['tx-attachments-get']({ transactionId })).toEqual(
      [],
    );
  });

  it('records what changed, newest first', async () => {
    const transactionId = await createTransaction(-9000);
    await app.handlers['tx-fx-set']({
      transactionId,
      currency: 'USD',
      amount: -1000,
    });
    const log = await app.handlers['audit-log-get']();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].summary).toContain('USD');
  });
});

describe('extras summary', () => {
  it('counts what each transaction has', async () => {
    const a = await createTransaction(-5000);
    const accountId = (await db.first<{ id: string }>(
      'SELECT id FROM accounts',
    ))!.id;
    const b = await db.insertTransaction({
      account: accountId,
      date: '2026-03-02',
      amount: 5000,
    });
    await app.handlers['tx-fx-set']({
      transactionId: a,
      currency: 'USD',
      amount: -6000,
    });
    await app.handlers['tx-link-create']({ a, b });

    const summary = await app.handlers['tx-extras-summary']();
    expect(summary.fx[a]).toEqual({ currency: 'USD', amount: -6000 });
    expect(summary.links[a]).toBe(1);
    expect(summary.links[b]).toBe(1);
    expect(summary.attachments).toEqual({});
  });
});
