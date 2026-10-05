import { createApp } from '#server/app';
import { ValidationError } from '#server/errors';
import { logAudit } from '#server/extras/audit';
import {
  createLinkedTransaction,
  deleteLinkedTransaction,
} from '#server/linked-transactions';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import { currentDay } from '#shared/months';
import { computeProgress } from '#shared/piggy-banks';
import type {
  PiggyBankEntity,
  PiggyBankEventEntity,
  PiggyBankProgress,
} from '#types/models';

import * as piggyDb from './db';

export type PiggyBanksHandlers = {
  'piggy-banks-get': typeof getPiggyBanks;
  'piggy-bank-create': typeof createPiggyBank;
  'piggy-bank-update': typeof updatePiggyBank;
  'piggy-bank-delete': typeof deletePiggyBank;
  'piggy-bank-move': typeof movePiggyBankMoney;
  'piggy-bank-events-get': typeof getEvents;
  'piggy-bank-event-delete': typeof deleteEvent;
};

export const app = createApp<PiggyBanksHandlers>();
app.method('piggy-banks-get', getPiggyBanks);
app.method('piggy-bank-create', mutator(undoable(createPiggyBank)));
app.method('piggy-bank-update', mutator(undoable(updatePiggyBank)));
app.method('piggy-bank-delete', mutator(undoable(deletePiggyBank)));
app.method('piggy-bank-move', mutator(undoable(movePiggyBankMoney)));
app.method('piggy-bank-events-get', getEvents);
app.method('piggy-bank-event-delete', mutator(undoable(deleteEvent)));

async function getPiggyBanks(): Promise<PiggyBankProgress[]> {
  const piggies = await piggyDb.getPiggyBanks();
  const saved = await piggyDb.getSavedAmounts();
  const today = currentDay();
  return piggies.map(piggy =>
    computeProgress(piggy, saved.get(piggy.id) ?? 0, today),
  );
}

async function createPiggyBank(
  piggy: Omit<Partial<PiggyBankEntity>, 'id'> & Pick<PiggyBankEntity, 'name'>,
): Promise<PiggyBankEntity['id']> {
  const id = await piggyDb.insertPiggy(piggy);
  await logAudit('piggy bank', 'create', `Created piggy bank ${piggy.name}`);
  return id;
}

async function updatePiggyBank(
  piggy: Partial<PiggyBankEntity> & Pick<PiggyBankEntity, 'id'>,
): Promise<void> {
  await piggyDb.updatePiggy(piggy);
  await logAudit(
    'piggy bank',
    'update',
    `Edited piggy bank ${piggy.name ?? piggy.id}`,
  );
}

async function deletePiggyBank({
  id,
}: Pick<PiggyBankEntity, 'id'>): Promise<void> {
  const piggy = await piggyDb.getPiggy(id);
  await piggyDb.deletePiggy(id);
  await logAudit(
    'piggy bank',
    'delete',
    `Deleted piggy bank ${piggy?.name ?? id}`,
  );
}

// A piggy bank never goes below zero.
async function movePiggyBankMoney({
  id,
  amount,
  date = currentDay(),
  notes = null,
  accountId,
  categoryId,
}: {
  id: PiggyBankEntity['id'];
  amount: number;
  date?: string;
  notes?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
}): Promise<PiggyBankEventEntity['id']> {
  if (amount < 0 && (await piggyDb.getSaved(id)) + amount < 0) {
    throw new ValidationError('There is not that much money in the piggy bank');
  }

  let transaction_id: string | null = null;
  if (accountId) {
    const piggy = await piggyDb.getPiggy(id);
    transaction_id = await createLinkedTransaction({
      accountId,
      categoryId,
      date,
      amount: -amount,
      notes: `Piggy bank: ${piggy?.name ?? ''}`,
    });
  }

  const piggyName = (await piggyDb.getPiggy(id))?.name ?? id;
  await logAudit(
    'piggy bank',
    'move',
    `${amount > 0 ? 'Put' : 'Took'} ${Math.abs(amount) / 100} ${amount > 0 ? 'into' : 'out of'} ${piggyName}`,
  );
  return piggyDb.insertEvent({
    piggy_bank_id: id,
    date,
    amount,
    notes,
    transaction_id,
  });
}

async function getEvents({
  id,
}: Pick<PiggyBankEntity, 'id'>): Promise<PiggyBankEventEntity[]> {
  return piggyDb.getEvents(id);
}

async function deleteEvent({
  id,
}: Pick<PiggyBankEventEntity, 'id'>): Promise<void> {
  const event = await piggyDb.getEvent(id);
  await deleteLinkedTransaction(event?.transaction_id);
  await piggyDb.deleteEvent(id);
}
