import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

function createPiggy() {
  return app.handlers['piggy-bank-create']({
    name: 'Holiday',
    target_amount: 100000,
  });
}

describe('piggy banks app', () => {
  it('adds up the money put in and taken out', async () => {
    const id = await createPiggy();
    await app.handlers['piggy-bank-move']({ id, amount: 30000 });
    await app.handlers['piggy-bank-move']({ id, amount: 20000 });
    await app.handlers['piggy-bank-move']({ id, amount: -5000 });

    const [piggy] = await app.handlers['piggy-banks-get']();
    expect(piggy.saved).toBe(45000);
    expect(piggy.percent).toBe(45);
    expect(await app.handlers['piggy-bank-events-get']({ id })).toHaveLength(3);
  });

  it('does not let a piggy bank go below zero', async () => {
    const id = await createPiggy();
    await app.handlers['piggy-bank-move']({ id, amount: 1000 });

    await expect(
      app.handlers['piggy-bank-move']({ id, amount: -2000 }),
    ).rejects.toThrow('not that much');
    await expect(
      app.handlers['piggy-bank-move']({ id, amount: 0 }),
    ).rejects.toThrow();
  });

  it('rejects a piggy bank without a name or with a bad target', async () => {
    await expect(
      app.handlers['piggy-bank-create']({ name: '' }),
    ).rejects.toThrow();
    await expect(
      app.handlers['piggy-bank-create']({ name: 'x', target_amount: 1.5 }),
    ).rejects.toThrow();
  });

  it('deletes the events with the piggy bank', async () => {
    const id = await createPiggy();
    await app.handlers['piggy-bank-move']({ id, amount: 1000 });
    await app.handlers['piggy-bank-delete']({ id });

    expect(await app.handlers['piggy-banks-get']()).toEqual([]);
    expect(await app.handlers['piggy-bank-events-get']({ id })).toEqual([]);
  });
});

describe('piggy banks linked to an account', () => {
  it('moves the money in the account and undoes it when the event goes', async () => {
    const accountId = await db.insertAccount({ name: 'Bank' });
    const id = await createPiggy();

    const eventId = await app.handlers['piggy-bank-move']({
      id,
      amount: 20000,
      accountId,
    });
    const rows = await db.all<{ amount: number }>(
      'SELECT amount FROM transactions WHERE acct = ? AND tombstone = 0',
      [accountId],
    );
    expect(rows.map(row => row.amount)).toEqual([-20000]);

    await app.handlers['piggy-bank-event-delete']({ id: eventId });
    const after = await db.all(
      'SELECT id FROM transactions WHERE acct = ? AND tombstone = 0',
      [accountId],
    );
    expect(after).toEqual([]);
  });
});
