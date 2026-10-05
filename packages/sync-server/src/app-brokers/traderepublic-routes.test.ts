import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestLoggerMiddleware } from '#util/middlewares';

import { handlers as brokersApp } from './app-brokers';
import {
  createFakeDeps,
  GOOD_CODE,
  GOOD_PIN,
  TR_PROCESS_ID,
} from './traderepublic-fixtures';
import type { FakeLog } from './traderepublic-fixtures';
import {
  createAttemptLimiter,
  createPendingLogins,
  PENDING_LOGIN_TTL_MS,
} from './traderepublic-guard';
import type { PendingLogins } from './traderepublic-guard';
import { createTradeRepublicRouter } from './traderepublic-routes';

const PHONE = '+34600123456';

let time: number;
let pending: PendingLogins;
let log: FakeLog;
let app: express.Express;

// Everything written to the console or to stdout/stderr, to make sure
// the PIN and the code never get there
let output: string[];

function capture() {
  output = [];
  const record = (...args: unknown[]) => {
    output.push(args.map(arg => String(arg)).join(' '));
  };
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation(record);
  }
  // The winston console transport writes to the console's own streams
  const streams = console as unknown as {
    _stdout?: NodeJS.WritableStream;
    _stderr?: NodeJS.WritableStream;
  };
  for (const stream of new Set([
    process.stdout,
    process.stderr,
    streams._stdout,
    streams._stderr,
  ])) {
    if (stream) {
      vi.spyOn(stream, 'write').mockImplementation((chunk: unknown) => {
        record(chunk);
        return true;
      });
    }
  }
}

beforeEach(() => {
  // A fixed clock so log timestamps cannot contain the PIN by chance
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  time = 1_000_000;
  pending = createPendingLogins(() => time);
  const fake = createFakeDeps();
  log = fake.log;

  app = express();
  app.use(express.json());
  app.use(requestLoggerMiddleware);
  // Stands in for the session check of the sync server
  app.use((req, res, next) => {
    res.locals = { user_id: req.get('x-test-user') ?? 'user-1' };
    next();
  });
  app.use(
    '/traderepublic',
    createTradeRepublicRouter({
      deps: fake.deps,
      pending,
      limiter: createAttemptLimiter({ now: () => time }),
    }),
  );
  capture();
});

afterEach(() => {
  pending.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const login = (body: unknown, user = 'user-1') =>
  request(app)
    .post('/traderepublic/login')
    .set('x-test-user', user)
    .send(body as object);

const verify = (body: unknown, user = 'user-1') =>
  request(app)
    .post('/traderepublic/verify')
    .set('x-test-user', user)
    .send(body as object);

describe('Trade Republic routes', () => {
  it('requires a session of the sync server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await request(brokersApp)
      .post('/traderepublic/login')
      .send({ phone: PHONE, pin: GOOD_PIN });
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs in, verifies the code and returns the trades', async () => {
    const first = await login({ phone: PHONE, pin: GOOD_PIN });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('ok');
    expect(first.body.data.secondsToCode).toBe(30);
    // The browser gets a handle of this server, not TR's process id
    const { processId } = first.body.data;
    expect(processId).not.toBe(TR_PROCESS_ID);

    const second = await verify({ processId, code: GOOD_CODE });
    expect(second.status).toBe(200);
    expect(second.body.data.trades.length).toBeGreaterThan(0);
    expect(
      second.body.data.trades.every((t: { importedId: string }) =>
        t.importedId.startsWith('tr:'),
      ),
    ).toBe(true);
    expect(pending.size()).toBe(0);
  });

  it('never puts the PIN or the code in answers or logs', async () => {
    const wrongPin = '1357';
    const answers = [
      await login({ phone: PHONE, pin: wrongPin }),
      await login({ phone: PHONE, pin: GOOD_PIN }),
    ];
    const processId = answers[1].body.data.processId;
    answers.push(await verify({ processId, code: GOOD_CODE }));
    answers.push(await verify({ processId, code: '2468' }));
    answers.push(
      await request(app)
        .post('/traderepublic/login')
        .set('Content-Type', 'application/json')
        .send(`{"phone":"${PHONE}","pin":"${GOOD_PIN}"`),
    );

    expect(answers[0].body).toEqual({
      status: 'error',
      reason: 'login-failed',
    });
    // Malformed JSON never reaches the route; the parser answers 400
    expect(answers[4].status).toBe(400);
    const text = JSON.stringify(answers.map(a => [a.body, a.text, a.headers]));
    for (const secret of [GOOD_PIN, wrongPin, GOOD_CODE, '2468']) {
      expect(text).not.toContain(secret);
    }

    // The request logger did run, but without bodies
    const logged = output.join('\n');
    expect(logged).toContain('/traderepublic/login');
    for (const secret of [GOOD_PIN, wrongPin, GOOD_CODE, '2468']) {
      expect(logged).not.toContain(secret);
    }
    // Nor did it reach TR anywhere but in the login body
    expect(log.urls.join(' ')).not.toContain(GOOD_PIN);
  });

  it('rejects bad input without calling TR', async () => {
    for (const body of [
      { phone: '600123456', pin: GOOD_PIN },
      { phone: PHONE, pin: '12345' },
      { phone: PHONE, pin: GOOD_PIN.repeat(400) },
    ]) {
      const res = await login(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ status: 'error', reason: 'invalid-input' });
    }
    expect(log.urls).toEqual([]);
  });

  it('lets a login be verified only once', async () => {
    const { processId } = (await login({ phone: PHONE, pin: GOOD_PIN })).body
      .data;
    const wrong = await verify({ processId, code: '0000' });
    expect(wrong.body).toEqual({ status: 'error', reason: 'invalid-code' });
    const retry = await verify({ processId, code: GOOD_CODE });
    expect(retry.body).toEqual({ status: 'error', reason: 'login-expired' });
  });

  it('forgets a login after five minutes', async () => {
    const { processId } = (await login({ phone: PHONE, pin: GOOD_PIN })).body
      .data;
    time += PENDING_LOGIN_TTL_MS;
    const res = await verify({ processId, code: GOOD_CODE });
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ status: 'error', reason: 'login-expired' });
  });

  it("does not let another user finish someone else's login", async () => {
    const { processId } = (await login({ phone: PHONE, pin: GOOD_PIN })).body
      .data;
    const res = await verify({ processId, code: GOOD_CODE }, 'user-2');
    expect(res.body).toEqual({ status: 'error', reason: 'login-expired' });
  });

  it('allows five login attempts every ten minutes', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login({ phone: PHONE, pin: '1111' })).status).toBe(401);
    }
    const blocked = await login({ phone: PHONE, pin: GOOD_PIN });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      status: 'error',
      reason: 'too-many-attempts',
    });
    // Blocked attempts never reach TR
    expect(log.urls).toHaveLength(5);
  });
});
