import * as db from '#server/db';
import { ValidationError } from '#server/errors';
import { fromDateRepr, requiredFields, toDateRepr } from '#server/models';
import { batchMessages } from '#server/sync';
import type { PiggyBankEntity, PiggyBankEventEntity } from '#types/models';

type DbPiggyBank = Omit<PiggyBankEntity, 'target_date'> & {
  target_date: number | null;
  tombstone: 1 | 0;
};

type DbPiggyBankEvent = Omit<PiggyBankEventEntity, 'date'> & {
  date: number;
  tombstone: 1 | 0;
};

const PIGGY_FIELDS = [
  'id',
  'name',
  'target_amount',
  'target_date',
  'account_id',
  'notes',
  'sort_order',
  'group_name',
] as const;

function pick<T extends object, K extends keyof T>(
  row: T,
  fields: readonly K[],
): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const field of fields) {
    if (Object.hasOwn(row, field)) {
      result[field] = row[field];
    }
  }
  return result as Pick<T, K>;
}

function validatePiggy<T extends Partial<PiggyBankEntity>>(
  piggy: T,
  { update }: { update?: boolean } = {},
) {
  requiredFields<Partial<PiggyBankEntity>, 'name'>(
    'piggy bank',
    piggy,
    ['name'],
    update,
  );

  const { target_date, ...row } = pick(piggy, PIGGY_FIELDS);
  if (row.name != null && row.name.trim() === '') {
    throw new ValidationError('A piggy bank needs a name');
  }
  if (
    row.target_amount != null &&
    !(Number.isInteger(row.target_amount) && row.target_amount >= 0)
  ) {
    throw new ValidationError(
      'target_amount must be a whole amount, not negative',
    );
  }

  if (target_date === undefined) {
    return row;
  }
  return {
    ...row,
    target_date: target_date == null ? null : toDateRepr(target_date),
  };
}

function toPiggy(row: DbPiggyBank): PiggyBankEntity {
  const { tombstone: _tombstone, target_date, ...piggy } = row;
  return {
    ...piggy,
    target_date: target_date == null ? null : fromDateRepr(target_date),
  };
}

function toEvent(row: DbPiggyBankEvent): PiggyBankEventEntity {
  const { tombstone: _tombstone, date, ...event } = row;
  return { ...event, date: fromDateRepr(date) };
}

export async function getPiggyBanks(): Promise<PiggyBankEntity[]> {
  const rows = await db.all<DbPiggyBank>(
    `SELECT * FROM piggy_banks WHERE tombstone = 0 ORDER BY sort_order, name, id`,
  );
  return rows.map(toPiggy);
}

export async function getSavedAmounts(): Promise<Map<string, number>> {
  const rows = await db.all<{ piggy_bank_id: string; saved: number }>(
    `SELECT piggy_bank_id, SUM(amount) AS saved
     FROM piggy_bank_events WHERE tombstone = 0 GROUP BY piggy_bank_id`,
  );
  return new Map(rows.map(row => [row.piggy_bank_id, row.saved]));
}

export async function getSaved(id: PiggyBankEntity['id']): Promise<number> {
  const row = await db.first<{ saved: number | null }>(
    `SELECT SUM(amount) AS saved FROM piggy_bank_events
     WHERE piggy_bank_id = ? AND tombstone = 0`,
    [id],
  );
  return row?.saved ?? 0;
}

export async function insertPiggy(
  piggy: Partial<PiggyBankEntity>,
): Promise<PiggyBankEntity['id']> {
  const last = await db.first<{ sort_order: number | null }>(
    `SELECT MAX(sort_order) AS sort_order FROM piggy_banks WHERE tombstone = 0`,
  );
  return db.insertWithUUID('piggy_banks', {
    target_amount: 0,
    sort_order: (last?.sort_order ?? 0) + 1,
    ...validatePiggy(piggy),
  });
}

export async function updatePiggy(
  piggy: Partial<PiggyBankEntity> & Pick<PiggyBankEntity, 'id'>,
) {
  await db.update('piggy_banks', validatePiggy(piggy, { update: true }));
}

export async function deletePiggy(id: PiggyBankEntity['id']) {
  const events = await db.all<Pick<DbPiggyBankEvent, 'id'>>(
    `SELECT id FROM piggy_bank_events WHERE piggy_bank_id = ? AND tombstone = 0`,
    [id],
  );

  await batchMessages(async () => {
    for (const event of events) {
      await db.delete_('piggy_bank_events', event.id);
    }
    await db.delete_('piggy_banks', id);
  });
}

export async function getEvents(
  piggyBankId: PiggyBankEntity['id'],
): Promise<PiggyBankEventEntity[]> {
  const rows = await db.all<DbPiggyBankEvent>(
    `SELECT * FROM piggy_bank_events
     WHERE piggy_bank_id = ? AND tombstone = 0 ORDER BY date DESC, id`,
    [piggyBankId],
  );
  return rows.map(toEvent);
}

export async function insertEvent(
  event: Pick<PiggyBankEventEntity, 'piggy_bank_id' | 'date' | 'amount'> &
    Partial<Pick<PiggyBankEventEntity, 'notes' | 'transaction_id'>>,
): Promise<PiggyBankEventEntity['id']> {
  if (!Number.isInteger(event.amount) || event.amount === 0) {
    throw new ValidationError('amount must be a whole amount that is not zero');
  }
  return db.insertWithUUID('piggy_bank_events', {
    piggy_bank_id: event.piggy_bank_id,
    amount: event.amount,
    notes: event.notes ?? null,
    transaction_id: event.transaction_id ?? null,
    date: toDateRepr(event.date),
  });
}

export async function getEvent(
  id: PiggyBankEventEntity['id'],
): Promise<PiggyBankEventEntity | null> {
  const row = await db.first<DbPiggyBankEvent>(
    `SELECT * FROM piggy_bank_events WHERE id = ? AND tombstone = 0`,
    [id],
  );
  return row ? toEvent(row) : null;
}

export async function getPiggy(
  id: PiggyBankEntity['id'],
): Promise<PiggyBankEntity | null> {
  const row = await db.first<DbPiggyBank>(
    `SELECT * FROM piggy_banks WHERE id = ? AND tombstone = 0`,
    [id],
  );
  return row ? toPiggy(row) : null;
}

export async function deleteEvent(id: PiggyBankEventEntity['id']) {
  await db.delete_('piggy_bank_events', id);
}
