import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

function createDebt() {
  return app.handlers['debt-create']({
    name: 'Car loan',
    principal: 1000000,
    interest_rate: 6,
  });
}

describe('debts app', () => {
  it('reduces what is owed with the principal part of each payment', async () => {
    const id = await createDebt();
    await app.handlers['debt-payment-create']({
      debt_id: id,
      amount: 30000,
      interest: 5000,
    });

    const [debt] = await app.handlers['debts-get']();
    expect(debt.outstanding).toBe(975000);
    expect(debt.interestPaid).toBe(5000);
    expect(debt.kind).toBe('loan');
    expect(debt.direction).toBe('owed_by_me');
  });

  it('rejects invalid debts and payments', async () => {
    await expect(app.handlers['debt-create']({ name: ' ' })).rejects.toThrow();
    await expect(
      app.handlers['debt-create']({ name: 'x', kind: 'gift' as never }),
    ).rejects.toThrow('Unknown debt kind');
    await expect(
      app.handlers['debt-create']({ name: 'x', principal: 10.5 }),
    ).rejects.toThrow();

    const id = await createDebt();
    await expect(
      app.handlers['debt-payment-create']({ debt_id: id, amount: 0 }),
    ).rejects.toThrow();
    await expect(
      app.handlers['debt-payment-create']({
        debt_id: id,
        amount: 100,
        interest: 200,
      }),
    ).rejects.toThrow('not more than');
  });

  it('deletes the payments with the debt', async () => {
    const id = await createDebt();
    await app.handlers['debt-payment-create']({ debt_id: id, amount: 100 });
    await app.handlers['debt-delete']({ id });

    expect(await app.handlers['debts-get']()).toEqual([]);
    expect(await app.handlers['debt-payments-get']({ id })).toEqual([]);
  });
});

describe('debts linked to an account', () => {
  it('takes the payment out of the account when I owe, and brings it in when I am owed', async () => {
    const accountId = await db.insertAccount({ name: 'Bank' });
    const owed = await createDebt();
    const lent = await app.handlers['debt-create']({
      name: 'Loan to a friend',
      principal: 50000,
      direction: 'owed_to_me',
    });

    await app.handlers['debt-payment-create']({
      debt_id: owed,
      amount: 30000,
      accountId,
    });
    await app.handlers['debt-payment-create']({
      debt_id: lent,
      amount: 10000,
      accountId,
    });

    const rows = await db.all<{ amount: number }>(
      'SELECT amount FROM transactions WHERE acct = ? AND tombstone = 0 ORDER BY amount',
      [accountId],
    );
    expect(rows.map(row => row.amount)).toEqual([-30000, 10000]);
  });
});
