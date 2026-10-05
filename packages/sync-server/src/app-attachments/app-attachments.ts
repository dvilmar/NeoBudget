import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import express from 'express';
import rateLimit from 'express-rate-limit';

import { config } from '#load-config';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 5000;
const UPLOADS_PER_MINUTE = 60;

const app = express();
export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(validateSessionMiddleware);

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: UPLOADS_PER_MINUTE,
  legacyHeaders: false,
  standardHeaders: true,
  skip: () => process.env.NODE_ENV === 'development',
});

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// Opaque bytes, but anything that looks like a program or web page is refused.
export function isDangerousContent(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 64)).toString('latin1');
  const lower = head.trimStart().toLowerCase();
  return (
    head.startsWith('MZ') ||
    head.startsWith('\x7fELF') ||
    head.startsWith('#!') ||
    lower.startsWith('<!doctype html') ||
    lower.startsWith('<html') ||
    lower.startsWith('<script') ||
    lower.startsWith('<svg')
  );
}

// Ids are generated here, so anything else is an attempt to reach a path
export function isAttachmentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
  );
}

function directory() {
  return join(resolve(config.get('userFiles')), 'attachments');
}

function pathOf(id: string) {
  return join(directory(), `${id}.bin`);
}

app.post('/', uploadLimiter, async (req, res) => {
  const { data } = req.body ?? {};
  if (typeof data !== 'string' || data === '' || !BASE64.test(data)) {
    res.status(400).send({ status: 'error', reason: 'invalid-data' });
    return;
  }

  // Check the encoded size first so a huge string is never decoded
  if (data.length > Math.ceil(MAX_BYTES / 3) * 4) {
    res.status(400).send({ status: 'error', reason: 'invalid-size' });
    return;
  }
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    res.status(400).send({ status: 'error', reason: 'invalid-size' });
    return;
  }
  if (isDangerousContent(bytes)) {
    res.status(400).send({ status: 'error', reason: 'invalid-type' });
    return;
  }

  await mkdir(directory(), { recursive: true });
  if ((await readdir(directory())).length >= MAX_ATTACHMENTS) {
    res.status(400).send({ status: 'error', reason: 'too-many' });
    return;
  }

  const id = randomUUID();
  await writeFile(pathOf(id), bytes);
  res.send({ status: 'ok', data: { id } });
});

app.post('/read', async (req, res) => {
  const { id } = req.body ?? {};
  if (!isAttachmentId(id)) {
    res.status(400).send({ status: 'error', reason: 'invalid-id' });
    return;
  }

  try {
    const bytes = await readFile(pathOf(id));
    res.send({ status: 'ok', data: { data: bytes.toString('base64') } });
  } catch {
    res.status(404).send({ status: 'error', reason: 'not-found' });
  }
});

app.post('/delete', async (req, res) => {
  const { id } = req.body ?? {};
  if (!isAttachmentId(id)) {
    res.status(400).send({ status: 'error', reason: 'invalid-id' });
    return;
  }

  await rm(pathOf(id), { force: true });
  res.send({ status: 'ok', data: {} });
});
