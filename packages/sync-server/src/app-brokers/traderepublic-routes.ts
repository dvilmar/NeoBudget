// Manual Trade Republic import, in two steps:
//   POST /login  {phone, pin}       -> {processId, secondsToCode}
//   POST /verify {processId, code}  -> BrokerStatement
//
// The PIN is only read from the body of /login, handed to the TR client
// for one request and dropped. It is never logged, stored, put in an
// error or echoed back. Errors are fixed codes. The `processId` the
// browser gets is a random handle of this server, not TR's own id.

import express from 'express';
import type { Request, Response } from 'express';

import {
  confirmLoginCode,
  defaultDeps,
  downloadTimeline,
  isTradeRepublicError,
  requestLoginCode,
} from './traderepublic-client';
import type {
  TradeRepublicDeps,
  TradeRepublicErrorCode,
} from './traderepublic-client';
import {
  createAttemptLimiter,
  createPendingLogins,
  parseLoginInput,
  parseVerifyInput,
} from './traderepublic-guard';
import type { AttemptLimiter, PendingLogins } from './traderepublic-guard';
import { needsDetail, parseTimeline } from './traderepublic-timeline';

type Reason = TradeRepublicErrorCode | 'invalid-input' | 'login-expired';

const STATUS_BY_REASON: Record<Reason, number> = {
  'invalid-input': 400,
  'login-failed': 401,
  'invalid-code': 401,
  'login-expired': 410,
  'too-many-attempts': 429,
  unavailable: 502,
};

function sendError(res: Response, reason: Reason) {
  res.status(STATUS_BY_REASON[reason]).send({ status: 'error', reason });
}

function reasonOf(error: unknown, fallback: Reason): Reason {
  return isTradeRepublicError(error) ? error.code : fallback;
}

function ownerOf(res: Response): string {
  const owner: unknown = res.locals?.user_id;
  return typeof owner === 'string' ? owner : '';
}

function clientKeys(kind: string, req: Request, res: Response) {
  return [`${kind}:user:${ownerOf(res)}`, `${kind}:ip:${req.ip ?? ''}`];
}

export type TradeRepublicRouterOptions = {
  deps?: TradeRepublicDeps;
  pending?: PendingLogins;
  limiter?: AttemptLimiter;
};

// Mount after the sync server's session check.
export function createTradeRepublicRouter({
  deps = defaultDeps,
  pending = createPendingLogins(),
  limiter = createAttemptLimiter(),
}: TradeRepublicRouterOptions = {}) {
  const router = express.Router();
  // Two short fields are all these routes take
  router.use(express.json({ limit: '1kb' }));

  router.post('/login', async (req, res) => {
    if (!limiter.tryConsume(clientKeys('login', req, res))) {
      sendError(res, 'too-many-attempts');
      return;
    }
    const input = parseLoginInput(req.body);
    if (!input) {
      sendError(res, 'invalid-input');
      return;
    }

    try {
      const { processId, secondsToCode } = await requestLoginCode(
        deps,
        input.phone,
        input.pin,
      );
      res.send({
        status: 'ok',
        data: {
          processId: pending.add(ownerOf(res), processId),
          secondsToCode,
        },
      });
    } catch (error) {
      sendError(res, reasonOf(error, 'login-failed'));
    }
  });

  router.post('/verify', async (req, res) => {
    if (!limiter.tryConsume(clientKeys('verify', req, res))) {
      sendError(res, 'too-many-attempts');
      return;
    }
    const input = parseVerifyInput(req.body);
    if (!input) {
      sendError(res, 'invalid-input');
      return;
    }
    // Single use: a wrong code means starting over from the PIN
    const trProcessId = pending.take(input.processId, ownerOf(res));
    if (!trProcessId) {
      sendError(res, 'login-expired');
      return;
    }

    let cookies: string;
    try {
      cookies = await confirmLoginCode(deps, trProcessId, input.code);
    } catch (error) {
      sendError(res, reasonOf(error, 'invalid-code'));
      return;
    }

    try {
      // The session only lives in this call and is never stored
      const entries = await downloadTimeline(deps, cookies, needsDetail);
      res.send({ status: 'ok', data: parseTimeline(entries) });
    } catch (error) {
      sendError(res, reasonOf(error, 'unavailable'));
    }
  });

  // Anything unexpected, such as a malformed body, gets a fixed answer
  // and is not logged, since the body may hold the PIN
  router.use(
    (
      _error: unknown,
      _req: Request,
      res: Response,
      _next: express.NextFunction,
    ) => {
      sendError(res, 'invalid-input');
    },
  );

  return router;
}
