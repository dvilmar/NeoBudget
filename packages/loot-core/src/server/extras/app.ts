import * as asyncStorage from '#platform/server/asyncStorage';
import { createApp } from '#server/app';
import * as db from '#server/db';
import { ValidationError } from '#server/errors';
import { getFxRate } from '#server/investments/db';
import { mutator } from '#server/mutators';
import { post } from '#server/post';
import { getServer } from '#server/server-config';
import { undoable } from '#server/undo';
import type {
  AuditLogEntity,
  TransactionAttachmentEntity,
  TransactionFxEntity,
  TransactionLinkType,
  TransactionLinkView,
} from '#types/models';

import { logAudit } from './audit';

const LINK_TYPES: TransactionLinkType[] = [
  'relates',
  'refund',
  'paid_by',
  'reimbursed',
];
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export type ExtrasHandlers = {
  'tx-fx-get': typeof getFx;
  'tx-fx-set': typeof setFx;
  'tx-fx-suggest': typeof suggestFx;
  'tx-fx-clear': typeof clearFx;
  'tx-links-get': typeof getLinks;
  'tx-link-create': typeof createLink;
  'tx-link-delete': typeof deleteLink;
  'tx-attachments-get': typeof getAttachments;
  'tx-attachment-add': typeof addAttachment;
  'tx-attachment-read': typeof readAttachment;
  'tx-attachment-delete': typeof deleteAttachment;
  'audit-log-get': typeof getAuditLog;
  'tx-extras-summary': typeof getExtrasSummary;
  'webhooks-list': typeof listWebhooks;
  'webhook-create': typeof createWebhook;
  'webhook-delete': typeof deleteWebhook;
  'webhooks-fire': typeof fireWebhooks;
};

export const app = createApp<ExtrasHandlers>();
app.method('tx-fx-get', getFx);
app.method('tx-fx-set', mutator(undoable(setFx)));
app.method('tx-fx-suggest', suggestFx);
app.method('tx-fx-clear', mutator(undoable(clearFx)));
app.method('tx-links-get', getLinks);
app.method('tx-link-create', mutator(undoable(createLink)));
app.method('tx-link-delete', mutator(undoable(deleteLink)));
app.method('tx-attachments-get', getAttachments);
app.method('tx-attachment-add', mutator(addAttachment));
app.method('tx-attachment-read', readAttachment);
app.method('tx-attachment-delete', mutator(deleteAttachment));
app.method('audit-log-get', getAuditLog);
app.method('tx-extras-summary', getExtrasSummary);
app.method('webhooks-list', listWebhooks);
app.method('webhook-create', createWebhook);
app.method('webhook-delete', deleteWebhook);
app.method('webhooks-fire', fireWebhooks);

async function getFx({
  transactionId,
}: {
  transactionId: string;
}): Promise<TransactionFxEntity | null> {
  const row = await db.first<TransactionFxEntity>(
    `SELECT id, transaction_id, currency, amount, rate FROM transaction_fx
     WHERE transaction_id = ? AND tombstone = 0`,
    [transactionId],
  );
  return row ?? null;
}

// Rate of the transaction's day from stored rates; null when there is none.
async function suggestFx({
  transactionId,
  currency,
  baseCurrency,
}: {
  transactionId: string;
  currency: string;
  baseCurrency: string;
}): Promise<{ rate: number; amount: number; date: string } | null> {
  const transaction = await db.first<{ amount: number; date: number }>(
    `SELECT amount, date FROM transactions WHERE id = ? AND tombstone = 0`,
    [transactionId],
  );
  if (!transaction) {
    return null;
  }
  const raw = String(transaction.date);
  const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const rate = await getFxRate(
    currency.trim().toUpperCase(),
    baseCurrency.trim().toUpperCase(),
    date,
  );
  if (rate == null || rate <= 0) {
    return null;
  }
  return {
    rate,
    amount: Math.round(Math.abs(transaction.amount) / rate),
    date,
  };
}

async function setFx({
  transactionId,
  currency,
  amount,
}: {
  transactionId: string;
  currency: string;
  amount: number;
}): Promise<void> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(code)) {
    throw new ValidationError('A currency code is 3 to 5 letters, like USD');
  }
  if (!Number.isInteger(amount) || amount === 0) {
    throw new ValidationError('amount must be a whole amount that is not zero');
  }

  const transaction = await db.first<{ amount: number }>(
    `SELECT amount FROM transactions WHERE id = ? AND tombstone = 0`,
    [transactionId],
  );
  if (!transaction) {
    throw new ValidationError('The transaction does not exist');
  }
  const rate = Math.abs(transaction.amount / amount);

  const existing = await getFx({ transactionId });
  if (existing) {
    await db.update('transaction_fx', {
      id: existing.id,
      currency: code,
      amount,
      rate,
    });
  } else {
    await db.insertWithUUID('transaction_fx', {
      transaction_id: transactionId,
      currency: code,
      amount,
      rate,
    });
  }
  await logAudit(
    'transaction',
    'update',
    `Foreign amount ${amount / 100} ${code}`,
  );
}

async function clearFx({
  transactionId,
}: {
  transactionId: string;
}): Promise<void> {
  const existing = await getFx({ transactionId });
  if (existing) {
    await db.delete_('transaction_fx', existing.id);
  }
}

async function getLinks({
  transactionId,
}: {
  transactionId: string;
}): Promise<TransactionLinkView[]> {
  const rows = await db.all<{
    id: string;
    transaction_a: string;
    transaction_b: string;
    link_type: TransactionLinkType;
  }>(
    `SELECT id, transaction_a, transaction_b, link_type FROM transaction_links
     WHERE (transaction_a = ? OR transaction_b = ?) AND tombstone = 0`,
    [transactionId, transactionId],
  );

  const links: TransactionLinkView[] = [];
  for (const row of rows) {
    const otherId =
      row.transaction_a === transactionId
        ? row.transaction_b
        : row.transaction_a;
    const other = await db.first<{
      id: string;
      date: number;
      amount: number;
      notes: string | null;
    }>(
      `SELECT id, date, amount, notes FROM transactions WHERE id = ? AND tombstone = 0`,
      [otherId],
    );
    links.push({
      ...row,
      other: other
        ? {
            id: other.id,
            // dates are stored as YYYYMMDD
            date: String(other.date).replace(
              /^(\d{4})(\d{2})(\d{2})$/,
              '$1-$2-$3',
            ),
            amount: other.amount,
            notes: other.notes,
          }
        : null,
    });
  }
  return links;
}

async function createLink({
  a,
  b,
  type = 'relates',
}: {
  a: string;
  b: string;
  type?: TransactionLinkType;
}): Promise<string> {
  if (a === b) {
    throw new ValidationError('A transaction cannot be linked to itself');
  }
  if (!LINK_TYPES.includes(type)) {
    throw new ValidationError(`Unknown link type: ${type}`);
  }

  const existing = await db.first<{ id: string }>(
    `SELECT id FROM transaction_links
     WHERE tombstone = 0 AND
       ((transaction_a = ? AND transaction_b = ?) OR (transaction_a = ? AND transaction_b = ?))`,
    [a, b, b, a],
  );
  if (existing) {
    return existing.id;
  }

  const id = await db.insertWithUUID('transaction_links', {
    transaction_a: a,
    transaction_b: b,
    link_type: type,
  });
  await logAudit('transaction', 'create', `Linked two transactions (${type})`);
  return id;
}

async function deleteLink({ id }: { id: string }): Promise<void> {
  await db.delete_('transaction_links', id);
}

async function getConnection() {
  const userToken = await asyncStorage.getItem('user-token');
  const server = getServer();
  if (!userToken || !server) {
    throw new ValidationError('A sync server is needed for attachments');
  }
  return {
    url: server.BASE_SERVER.replace(/\/+$/, '') + '/attachments',
    headers: { 'X-ACTUAL-TOKEN': userToken },
  };
}

async function getAttachments({
  transactionId,
}: {
  transactionId: string;
}): Promise<TransactionAttachmentEntity[]> {
  return db.all<TransactionAttachmentEntity>(
    `SELECT id, transaction_id, name, mime, size, remote_id FROM transaction_attachments
     WHERE transaction_id = ? AND tombstone = 0 ORDER BY name`,
    [transactionId],
  );
}

async function addAttachment({
  transactionId,
  name,
  mime,
  data,
}: {
  transactionId: string;
  name: string;
  mime: string;
  data: string;
}): Promise<string> {
  const size = Math.floor((data.length * 3) / 4);
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError('The file is bigger than 8 MB');
  }

  const connection = await getConnection();
  const { id: remoteId } = await post(
    connection.url,
    { name, mime, data },
    connection.headers,
    60000,
  );

  const id = await db.insertWithUUID('transaction_attachments', {
    transaction_id: transactionId,
    name,
    mime,
    size,
    remote_id: remoteId,
  });
  await logAudit('transaction', 'create', `Attached ${name}`);
  return id;
}

async function readAttachment({
  id,
}: {
  id: string;
}): Promise<{ name: string; mime: string | null; data: string }> {
  const row = await db.first<TransactionAttachmentEntity>(
    `SELECT id, transaction_id, name, mime, size, remote_id FROM transaction_attachments
     WHERE id = ? AND tombstone = 0`,
    [id],
  );
  if (!row?.remote_id) {
    throw new ValidationError('The attachment does not exist');
  }

  const connection = await getConnection();
  const { data } = await post(
    `${connection.url}/read`,
    { id: row.remote_id },
    connection.headers,
    60000,
  );
  return { name: row.name, mime: row.mime, data };
}

async function deleteAttachment({ id }: { id: string }): Promise<void> {
  const row = await db.first<TransactionAttachmentEntity>(
    `SELECT id, transaction_id, name, mime, size, remote_id FROM transaction_attachments
     WHERE id = ? AND tombstone = 0`,
    [id],
  );
  if (!row) {
    return;
  }

  if (row.remote_id) {
    try {
      const connection = await getConnection();
      await post(
        `${connection.url}/delete`,
        { id: row.remote_id },
        connection.headers,
        30000,
      );
    } catch {
      // The record goes anyway; the file may stay orphaned in the server
    }
  }
  await db.delete_('transaction_attachments', id);
}

async function getAuditLog({ limit = 100 }: { limit?: number } = {}): Promise<
  AuditLogEntity[]
> {
  return db.all<AuditLogEntity>(
    `SELECT id, at, entity, action, summary FROM audit_log
     WHERE tombstone = 0 ORDER BY at DESC, id LIMIT ?`,
    [Math.min(Math.max(limit, 1), 500)],
  );
}

async function getWebhookConnection() {
  const connection = await getConnection();
  return {
    ...connection,
    url: connection.url.replace(/\/attachments$/, '/webhooks'),
  };
}

async function listWebhooks(): Promise<
  { id: string; url: string; active: number }[]
> {
  const connection = await getWebhookConnection();
  return post(`${connection.url}/list`, {}, connection.headers, 15000);
}

async function createWebhook({ url }: { url: string }): Promise<string> {
  const connection = await getWebhookConnection();
  const { id } = await post(
    `${connection.url}/create`,
    { url },
    connection.headers,
    15000,
  );
  return id;
}

async function deleteWebhook({ id }: { id: string }): Promise<void> {
  const connection = await getWebhookConnection();
  await post(`${connection.url}/delete`, { id }, connection.headers, 15000);
}

async function fireWebhooks({
  event,
  payload,
}: {
  event: string;
  payload?: unknown;
}): Promise<{ id: string; ok: boolean; status: number; error?: string }[]> {
  const connection = await getWebhookConnection();
  return post(
    `${connection.url}/fire`,
    { event, payload },
    connection.headers,
    30000,
  );
}

export type ExtrasSummary = {
  fx: Record<string, { currency: string; amount: number }>;
  links: Record<string, number>;
  attachments: Record<string, number>;
};

async function getExtrasSummary(): Promise<ExtrasSummary> {
  const fx = await db.all<{
    transaction_id: string;
    currency: string;
    amount: number;
  }>(
    `SELECT transaction_id, currency, amount FROM transaction_fx WHERE tombstone = 0`,
  );
  const links = await db.all<{ transaction_a: string; transaction_b: string }>(
    `SELECT transaction_a, transaction_b FROM transaction_links WHERE tombstone = 0`,
  );
  const attachments = await db.all<{ transaction_id: string; count: number }>(
    `SELECT transaction_id, COUNT(*) AS count FROM transaction_attachments
     WHERE tombstone = 0 GROUP BY transaction_id`,
  );

  const linkCounts: Record<string, number> = {};
  for (const link of links) {
    for (const id of [link.transaction_a, link.transaction_b]) {
      linkCounts[id] = (linkCounts[id] ?? 0) + 1;
    }
  }

  return {
    fx: Object.fromEntries(
      fx.map(row => [
        row.transaction_id,
        { currency: row.currency, amount: row.amount },
      ]),
    ),
    links: linkCounts,
    attachments: Object.fromEntries(
      attachments.map(row => [row.transaction_id, row.count]),
    ),
  };
}
