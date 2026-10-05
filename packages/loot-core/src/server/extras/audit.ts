import * as db from '#server/db';

export async function logAudit(
  entity: string,
  action: 'create' | 'update' | 'delete' | 'move',
  summary: string,
): Promise<void> {
  await db.insertWithUUID('audit_log', {
    at: new Date().toISOString(),
    entity,
    action,
    summary,
  });
}
