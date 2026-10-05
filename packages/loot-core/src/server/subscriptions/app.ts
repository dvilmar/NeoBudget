import { createApp } from '#server/app';
import * as db from '#server/db';
import { logAudit } from '#server/extras/audit';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';

export type SubscriptionsHandlers = {
  'subscriptions-get': typeof getSubscriptions;
  'subscription-set': typeof setSubscription;
};

export const app = createApp<SubscriptionsHandlers>();
app.method('subscriptions-get', getSubscriptions);
app.method('subscription-set', mutator(undoable(setSubscription)));

async function getSubscriptions(): Promise<
  { scheduleId: string; groupName: string | null }[]
> {
  const rows = await db.all<{ schedule_id: string; group_name: string | null }>(
    `SELECT schedule_id, group_name FROM subscriptions WHERE tombstone = 0`,
  );
  return rows.map(row => ({
    scheduleId: row.schedule_id,
    groupName: row.group_name,
  }));
}

async function setSubscription({
  scheduleId,
  isSubscription,
  groupName,
}: {
  scheduleId: string;
  isSubscription: boolean;
  groupName?: string | null;
}): Promise<void> {
  await logAudit(
    'subscription',
    'update',
    isSubscription
      ? 'Marked a schedule as a subscription'
      : 'Unmarked a subscription',
  );

  const existing = await db.first<{ id: string }>(
    `SELECT id FROM subscriptions WHERE schedule_id = ? AND tombstone = 0`,
    [scheduleId],
  );

  if (isSubscription && !existing) {
    await db.insertWithUUID('subscriptions', {
      schedule_id: scheduleId,
      group_name: groupName?.trim() || null,
    });
  } else if (isSubscription && existing && groupName !== undefined) {
    await db.update('subscriptions', {
      id: existing.id,
      group_name: groupName?.trim() || null,
    });
  } else if (!isSubscription && existing) {
    await db.delete_('subscriptions', existing.id);
  }
}
