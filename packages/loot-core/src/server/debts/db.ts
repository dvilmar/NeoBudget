import * as db from '#server/db';
import { ValidationError } from '#server/errors';
import { fromDateRepr, requiredFields, toDateRepr } from '#server/models';
import { batchMessages } from '#server/sync';
import type {
  DebtDirection,
  DebtEntity,
  DebtKind,
  DebtPaymentEntity,
} from '#types/models';

type DbDebt = Omit<DebtEntity, 'start_date'> & {
  start_date: number | null;
  tombstone: 1 | 0;
};

type DbPayment = Omit<DebtPaymentEntity, 'date'> & {
  date: number;
  tombstone: 1 | 0;
};

const KINDS: DebtKind[] = ['loan', 'debt', 'mortgage'];
const DIRECTIONS: DebtDirection[] = ['owed_by_me', 'owed_to_me'];

const DEBT_FIELDS = [
  'id',
  'name',
  'kind',
  'direction',
  'principal',
  'interest_rate',
  'start_date',
  'monthly_payment',
  'account_id',
  'notes',
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

function assertAmount(name: string, value: unknown) {
  if (value != null && !(Number.isInteger(value) && (value as number) >= 0)) {
    throw new ValidationError(`${name} must be a whole amount, not negative`);
  }
}

function validateDebt<T extends Partial<DebtEntity>>(
  debt: T,
  { update }: { update?: boolean } = {},
) {
  requiredFields<Partial<DebtEntity>, 'name'>('debt', debt, ['name'], update);

  const { start_date, ...row } = pick(debt, DEBT_FIELDS);
  if (row.name != null && row.name.trim() === '') {
    throw new ValidationError('A debt needs a name');
  }
  if (row.kind != null && !KINDS.includes(row.kind)) {
    throw new ValidationError(`Unknown debt kind: ${row.kind}`);
  }
  if (row.direction != null && !DIRECTIONS.includes(row.direction)) {
    throw new ValidationError(`Unknown debt direction: ${row.direction}`);
  }
  assertAmount('principal', row.principal);
  assertAmount('monthly_payment', row.monthly_payment);
  if (
    row.interest_rate != null &&
    !(typeof row.interest_rate === 'number' && row.interest_rate >= 0)
  ) {
    throw new ValidationError('interest_rate must not be negative');
  }

  if (start_date === undefined) {
    return row;
  }
  return {
    ...row,
    start_date: start_date == null ? null : toDateRepr(start_date),
  };
}

function toDebt(row: DbDebt): DebtEntity {
  const { tombstone: _tombstone, start_date, ...debt } = row;
  return {
    ...debt,
    start_date: start_date == null ? null : fromDateRepr(start_date),
  };
}

function toPayment(row: DbPayment): DebtPaymentEntity {
  const { tombstone: _tombstone, date, ...payment } = row;
  return { ...payment, date: fromDateRepr(date) };
}

export async function getDebts(): Promise<DebtEntity[]> {
  const rows = await db.all<DbDebt>(
    `SELECT * FROM debts WHERE tombstone = 0 ORDER BY name, id`,
  );
  return rows.map(toDebt);
}

export async function getAllPayments(): Promise<DebtPaymentEntity[]> {
  const rows = await db.all<DbPayment>(
    `SELECT * FROM debt_payments WHERE tombstone = 0 ORDER BY date, id`,
  );
  return rows.map(toPayment);
}

export async function getPayments(
  debtId: DebtEntity['id'],
): Promise<DebtPaymentEntity[]> {
  const rows = await db.all<DbPayment>(
    `SELECT * FROM debt_payments
     WHERE debt_id = ? AND tombstone = 0 ORDER BY date DESC, id`,
    [debtId],
  );
  return rows.map(toPayment);
}

export async function insertDebt(
  debt: Partial<DebtEntity>,
): Promise<DebtEntity['id']> {
  return db.insertWithUUID('debts', {
    kind: 'loan',
    direction: 'owed_by_me',
    principal: 0,
    interest_rate: 0,
    ...validateDebt(debt),
  });
}

export async function updateDebt(
  debt: Partial<DebtEntity> & Pick<DebtEntity, 'id'>,
) {
  await db.update('debts', validateDebt(debt, { update: true }));
}

export async function deleteDebt(id: DebtEntity['id']) {
  const payments = await db.all<Pick<DbPayment, 'id'>>(
    `SELECT id FROM debt_payments WHERE debt_id = ? AND tombstone = 0`,
    [id],
  );

  await batchMessages(async () => {
    for (const payment of payments) {
      await db.delete_('debt_payments', payment.id);
    }
    await db.delete_('debts', id);
  });
}

export async function insertPayment(
  payment: Pick<DebtPaymentEntity, 'debt_id' | 'date' | 'amount'> &
    Partial<Pick<DebtPaymentEntity, 'interest' | 'notes' | 'transaction_id'>>,
): Promise<DebtPaymentEntity['id']> {
  const interest = payment.interest ?? 0;
  if (!Number.isInteger(payment.amount) || payment.amount <= 0) {
    throw new ValidationError('amount must be a whole amount above zero');
  }
  if (
    !Number.isInteger(interest) ||
    interest < 0 ||
    interest > payment.amount
  ) {
    throw new ValidationError(
      'interest must be a whole amount that is not more than the payment',
    );
  }
  return db.insertWithUUID('debt_payments', {
    debt_id: payment.debt_id,
    amount: payment.amount,
    interest,
    date: toDateRepr(payment.date),
    notes: payment.notes ?? null,
    transaction_id: payment.transaction_id ?? null,
  });
}

export async function getPayment(
  id: DebtPaymentEntity['id'],
): Promise<DebtPaymentEntity | null> {
  const row = await db.first<DbPayment>(
    `SELECT * FROM debt_payments WHERE id = ? AND tombstone = 0`,
    [id],
  );
  return row ? toPayment(row) : null;
}

export async function getDebt(
  id: DebtEntity['id'],
): Promise<DebtEntity | null> {
  const row = await db.first<DbDebt>(
    `SELECT * FROM debts WHERE id = ? AND tombstone = 0`,
    [id],
  );
  return row ? toDebt(row) : null;
}

export async function deletePayment(id: DebtPaymentEntity['id']) {
  await db.delete_('debt_payments', id);
}
