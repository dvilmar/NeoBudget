import { randomUUID } from 'node:crypto';

import express from 'express';
import rateLimit from 'express-rate-limit';

import { getAccountDb } from '#account-db';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';
import { assertUrlAllowed } from '#util/ssrf';

const FIRE_TIMEOUT_MS = 5000;
const MAX_WEBHOOKS = 20;
const MAX_EVENT_LENGTH = 100;
const FIRES_PER_MINUTE = 30;
const CREATES_PER_MINUTE = 20;

type Webhook = { id: string; url: string; active: number };

const app = express();
export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(validateSessionMiddleware);

function limiter(limit: number) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    legacyHeaders: false,
    standardHeaders: true,
    skip: () => process.env.NODE_ENV === 'development',
  });
}

// Webhooks pointing at the server's own machine or local network are
// refused unless the owner opts in with this variable
export function allowPrivateWebhooks(): boolean {
  return process.env.ACTUAL_WEBHOOKS_ALLOW_PRIVATE_NETWORK === 'true';
}

// Throws when the address is not a safe destination. Checked when the
// webhook is created and again on every delivery, because DNS can change.
export async function assertWebhookAllowed(url: string): Promise<void> {
  await assertUrlAllowed(url, { allowPrivateNetwork: allowPrivateWebhooks() });
}

export function isValidWebhookUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function list(): Webhook[] {
  return getAccountDb().all(
    'SELECT id, url, active FROM webhooks ORDER BY created_at',
  ) as Webhook[];
}

async function deliver(webhook: Webhook, event: string, payload: unknown) {
  try {
    await assertWebhookAllowed(webhook.url);
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, at: new Date().toISOString(), payload }),
      signal: AbortSignal.timeout(FIRE_TIMEOUT_MS),
      // A redirect could lead to an address that was never checked
      redirect: 'manual',
    });
    return { id: webhook.id, ok: response.ok, status: response.status };
  } catch (error) {
    return {
      id: webhook.id,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

app.post('/list', (req, res) => {
  res.send({ status: 'ok', data: list() });
});

app.post('/create', limiter(CREATES_PER_MINUTE), async (req, res) => {
  const { url } = req.body ?? {};
  if (!isValidWebhookUrl(url)) {
    res.status(400).send({ status: 'error', reason: 'invalid-url' });
    return;
  }
  try {
    await assertWebhookAllowed(url);
  } catch (error) {
    res.status(400).send({
      status: 'error',
      reason: 'blocked-url',
      details: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  if (list().length >= MAX_WEBHOOKS) {
    res.status(400).send({ status: 'error', reason: 'too-many' });
    return;
  }

  const id = randomUUID();
  getAccountDb().mutate(
    'INSERT INTO webhooks (id, url, active, created_at) VALUES (?, ?, 1, ?)',
    [id, url, new Date().toISOString()],
  );
  res.send({ status: 'ok', data: { id } });
});

app.post('/delete', (req, res) => {
  const { id } = req.body ?? {};
  if (typeof id !== 'string') {
    res.status(400).send({ status: 'error', reason: 'invalid-id' });
    return;
  }
  getAccountDb().mutate('DELETE FROM webhooks WHERE id = ?', [id]);
  res.send({ status: 'ok', data: {} });
});

// A failing webhook never blocks the others.
app.post('/fire', limiter(FIRES_PER_MINUTE), async (req, res) => {
  const { event, payload } = req.body ?? {};
  if (
    typeof event !== 'string' ||
    event === '' ||
    event.length > MAX_EVENT_LENGTH
  ) {
    res.status(400).send({ status: 'error', reason: 'invalid-event' });
    return;
  }

  const results = [];
  for (const webhook of list().filter(item => item.active)) {
    results.push(await deliver(webhook, event, payload ?? null));
  }
  res.send({ status: 'ok', data: results });
});
