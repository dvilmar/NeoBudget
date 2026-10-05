import { createApp } from '#server/app';
import { logAudit } from '#server/extras/audit';
import {
  createLinkedTransaction,
  deleteLinkedTransaction,
} from '#server/linked-transactions';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import { computeDebt } from '#shared/debts';
import { currentDay } from '#shared/months';
import type {
  DebtEntity,
  DebtPaymentEntity,
  DebtProgress,
} from '#types/models';

import * as debtsDb from './db';

export type DebtsHandlers = {
  'debts-get': typeof getDebts;
  'debt-create': typeof createDebt;
  'debt-update': typeof updateDebt;
  'debt-delete': typeof deleteDebt;
  'debt-payment-create': typeof createPayment;
  'debt-payments-get': typeof getPayments;
  'debt-payment-delete': typeof deletePayment;
};

export const app = createApp<DebtsHandlers>();
app.method('debts-get', getDebts);
app.method('debt-create', mutator(undoable(createDebt)));
app.method('debt-update', mutator(undoable(updateDebt)));
app.method('debt-delete', mutator(undoable(deleteDebt)));
app.method('debt-payment-create', mutator(undoable(createPayment)));
app.method('debt-payments-get', getPayments);
app.method('debt-payment-delete', mutator(undoable(deletePayment)));

async function getDebts(): Promise<DebtProgress[]> {
  const debts = await debtsDb.getDebts();
  const payments = await debtsDb.getAllPayments();

  return debts.map(debt =>
    computeDebt(
      debt,
      payments.filter(payment => payment.debt_id === debt.id),
    ),
  );
}

async function createDebt(
  debt: Omit<Partial<DebtEntity>, 'id'> & Pick<DebtEntity, 'name'>,
): Promise<DebtEntity['id']> {
  const id = await debtsDb.insertDebt(debt);
  await logAudit('debt', 'create', `Created debt ${debt.name}`);
  return id;
}

async function updateDebt(
  debt: Partial<DebtEntity> & Pick<DebtEntity, 'id'>,
): Promise<void> {
  await debtsDb.updateDebt(debt);
  await logAudit('debt', 'update', `Edited debt ${debt.name ?? debt.id}`);
}

async function deleteDebt({ id }: Pick<DebtEntity, 'id'>): Promise<void> {
  const debt = await debtsDb.getDebt(id);
  await debtsDb.deleteDebt(id);
  await logAudit('debt', 'delete', `Deleted debt ${debt?.name ?? id}`);
}

// With an account, the payment also moves real money there.
async function createPayment({
  debt_id,
  amount,
  interest,
  date = currentDay(),
  notes,
  accountId,
  categoryId,
}: Pick<DebtPaymentEntity, 'debt_id' | 'amount'> &
  Partial<Pick<DebtPaymentEntity, 'interest' | 'date' | 'notes'>> & {
    accountId?: string | null;
    categoryId?: string | null;
  }): Promise<DebtPaymentEntity['id']> {
  let transaction_id: string | null = null;
  if (accountId) {
    const debt = await debtsDb.getDebt(debt_id);
    transaction_id = await createLinkedTransaction({
      accountId,
      categoryId,
      date,
      amount: debt?.direction === 'owed_to_me' ? amount : -amount,
      notes: `Debt: ${debt?.name ?? ''}`,
    });
  }
  await logAudit('debt', 'move', `Payment of ${amount / 100} on a debt`);
  return debtsDb.insertPayment({
    debt_id,
    amount,
    interest,
    date,
    notes,
    transaction_id,
  });
}

async function getPayments({
  id,
}: Pick<DebtEntity, 'id'>): Promise<DebtPaymentEntity[]> {
  return debtsDb.getPayments(id);
}

async function deletePayment({
  id,
}: Pick<DebtPaymentEntity, 'id'>): Promise<void> {
  const payment = await debtsDb.getPayment(id);
  await deleteLinkedTransaction(payment?.transaction_id);
  await debtsDb.deletePayment(id);
}
