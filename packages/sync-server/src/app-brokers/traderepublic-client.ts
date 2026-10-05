// Read-only client for the private API of the Trade Republic web app.
//
// UNOFFICIAL: Trade Republic has no public API. Everything here is a
// clean-room reimplementation of how the web app (app.traderepublic.com)
// is generally understood to talk to its backend. None of it has been
// checked against the real service from this code base, so endpoint
// paths, field names and message formats may need adjusting on the first
// real test. Places that rely on such guesses are marked "UNVERIFIED".
//
// SAFETY: only the calls in the allow lists below can be made. They log
// in and read the timeline. There is no way to place orders, move money
// or change anything in the account, and nothing is ever written to disk.

export const TR_HOST = 'api.traderepublic.com';
const API_ORIGIN = `https://${TR_HOST}`;
const SOCKET_URL = `wss://${TR_HOST}`;

// REST calls this module may make, all of them POST
const ALLOWED_REST_PATHS: readonly RegExp[] = [
  // Step 1: phone number and PIN, answers with a process id and sends
  // a code to the phone
  /^\/api\/v1\/auth\/web\/login$/,
  // Step 2: the code, answers with the session cookies
  /^\/api\/v1\/auth\/web\/login\/[A-Za-z0-9-]{1,100}\/\d{4}$/,
];

// WebSocket subscriptions this module may open, all of them reads
export const ALLOWED_SUBSCRIPTIONS = [
  'timelineTransactions',
  'timelineDetailV2',
] as const;
type Subscription = (typeof ALLOWED_SUBSCRIPTIONS)[number];

const REQUEST_TIMEOUT_MS = 20 * 1000;
const SUBSCRIPTION_TIMEOUT_MS = 20 * 1000;
// Guards against a cursor that never ends
const MAX_TIMELINE_PAGES = 500;
const MAX_TIMELINE_ITEMS = 20000;

export type TradeRepublicErrorCode =
  | 'login-failed'
  | 'invalid-code'
  | 'too-many-attempts'
  | 'unavailable';

// Errors carry a fixed code and never any input or raw answer, so they
// are safe to log or send back
export type TradeRepublicError = Error & { code: TradeRepublicErrorCode };

export function tradeRepublicError(
  code: TradeRepublicErrorCode,
): TradeRepublicError {
  const error = new Error(`Trade Republic: ${code}`) as TradeRepublicError;
  error.code = code;
  return error;
}

const ERROR_CODES: readonly string[] = [
  'login-failed',
  'invalid-code',
  'too-many-attempts',
  'unavailable',
];

export function isTradeRepublicError(
  error: unknown,
): error is TradeRepublicError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    ERROR_CODES.includes(error.code)
  );
}

export type FetchLike = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body?: string;
    redirect: 'manual';
    signal: AbortSignal;
  },
) => Promise<{
  status: number;
  headers: { getSetCookie(): string[] };
  json(): Promise<unknown>;
}>;

export type SocketLike = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
};

export type SocketFactory = (
  url: string,
  headers: Record<string, string>,
) => SocketLike;

export type TradeRepublicDeps = {
  fetch: FetchLike;
  openSocket: SocketFactory;
};

// Node 22 ships a WebSocket (undici), so no extra dependency is needed.
// Its non-standard second argument takes extra headers, which is how
// the session cookies reach the socket. UNVERIFIED against TR.
function openNodeSocket(url: string, headers: Record<string, string>) {
  if (typeof globalThis.WebSocket !== 'function') {
    throw tradeRepublicError('unavailable');
  }
  const NodeSocket = globalThis.WebSocket as unknown as new (
    url: string,
    init: { headers: Record<string, string> },
  ) => SocketLike;
  return new NodeSocket(url, { headers });
}

export const defaultDeps: TradeRepublicDeps = {
  fetch: (url, init) => fetch(url, init),
  openSocket: openNodeSocket,
};

export function isAllowedRestUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === 'https:' &&
    parsed.host === TR_HOST &&
    parsed.search === '' &&
    ALLOWED_REST_PATHS.some(path => path.test(parsed.pathname))
  );
}

export function isAllowedSocketUrl(url: string): boolean {
  return url === SOCKET_URL;
}

export function isAllowedSubscription(type: string): type is Subscription {
  return (ALLOWED_SUBSCRIPTIONS as readonly string[]).includes(type);
}

async function postToTr(
  deps: TradeRepublicDeps,
  path: string,
  body: string | undefined,
  failure: TradeRepublicErrorCode,
) {
  const url = API_ORIGIN + path;
  if (!isAllowedRestUrl(url)) {
    throw tradeRepublicError('unavailable');
  }

  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await deps.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      // A redirect could point anywhere, so none is followed
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw tradeRepublicError('unavailable');
  }

  if (res.status === 429) {
    throw tradeRepublicError('too-many-attempts');
  }
  if (res.status >= 300 && res.status < 400) {
    throw tradeRepublicError('unavailable');
  }
  if (res.status >= 500) {
    throw tradeRepublicError('unavailable');
  }
  if (res.status !== 200) {
    // UNVERIFIED: Trade Republic is said to answer a throttled login
    // with a 4xx whose errors carry the TOO_MANY_REQUESTS code
    const data = await res.json().catch(() => null);
    const errors =
      isRecord(data) && Array.isArray(data.errors) ? data.errors : [];
    const throttled = errors.some(
      error => isRecord(error) && error.errorCode === 'TOO_MANY_REQUESTS',
    );
    throw tradeRepublicError(throttled ? 'too-many-attempts' : failure);
  }
  return res;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Step 1. The PIN only lives in the body of this one request.
// UNVERIFIED: path, body fields and the `processId` and
// `countdownInSeconds` answer fields.
export async function requestLoginCode(
  deps: TradeRepublicDeps,
  phone: string,
  pin: string,
): Promise<{ processId: string; secondsToCode: number }> {
  let body: string | undefined = JSON.stringify({ phoneNumber: phone, pin });
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await postToTr(deps, '/api/v1/auth/web/login', body, 'login-failed');
  } finally {
    body = undefined;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw tradeRepublicError('login-failed');
  }
  if (
    !isRecord(data) ||
    typeof data.processId !== 'string' ||
    !/^[A-Za-z0-9-]{1,100}$/.test(data.processId)
  ) {
    throw tradeRepublicError('login-failed');
  }
  const countdown = Number(data.countdownInSeconds);
  return {
    processId: data.processId,
    secondsToCode:
      Number.isFinite(countdown) && countdown > 0 ? Math.round(countdown) : 0,
  };
}

// Step 2. Answers with the session cookies, which only live in memory
// for as long as the timeline takes to download.
// UNVERIFIED: path and that the session comes back as cookies.
export async function confirmLoginCode(
  deps: TradeRepublicDeps,
  processId: string,
  code: string,
): Promise<string> {
  const res = await postToTr(
    deps,
    `/api/v1/auth/web/login/${processId}/${code}`,
    undefined,
    'invalid-code',
  );
  const cookies = res.headers
    .getSetCookie()
    .map(cookie => cookie.split(';')[0].trim())
    .filter(cookie => /^[\w.-]+=[^\s;]*$/.test(cookie));
  if (cookies.length === 0) {
    throw tradeRepublicError('invalid-code');
  }
  return cookies.join('; ');
}

type TimelineSession = {
  read(type: Subscription, params: Record<string, string>): Promise<unknown>;
  close(): void;
};

// UNVERIFIED: the text protocol of the socket. The client says
// "connect <version> <json>" and waits for "connected"; then each
// "sub <id> <json>" is answered with "<id> A <json>" (full payload),
// "<id> D <diff>" (changes, unused here: every read stops after its
// first payload), "<id> C" (closed) or "<id> E <json>" (error).
function openTimelineSession(
  deps: TradeRepublicDeps,
  cookies: string,
): Promise<TimelineSession> {
  return new Promise((resolve, reject) => {
    if (!isAllowedSocketUrl(SOCKET_URL)) {
      reject(tradeRepublicError('unavailable'));
      return;
    }
    let socket: SocketLike;
    try {
      socket = deps.openSocket(SOCKET_URL, { Cookie: cookies });
    } catch {
      reject(tradeRepublicError('unavailable'));
      return;
    }
    const pending = new Map<
      string,
      {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >();
    let nextId = 1;
    let connected = false;

    function failAll() {
      for (const [id, request] of pending) {
        clearTimeout(request.timer);
        request.reject(tradeRepublicError('unavailable'));
        pending.delete(id);
      }
    }

    const connectTimer = setTimeout(() => {
      socket.close();
      reject(tradeRepublicError('unavailable'));
    }, SUBSCRIPTION_TIMEOUT_MS);

    const session: TimelineSession = {
      read(type, params) {
        if (!isAllowedSubscription(type)) {
          return Promise.reject(tradeRepublicError('unavailable'));
        }
        const id = String(nextId++);
        return new Promise((resolveRead, rejectRead) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            rejectRead(tradeRepublicError('unavailable'));
          }, SUBSCRIPTION_TIMEOUT_MS);
          pending.set(id, {
            resolve: resolveRead,
            reject: rejectRead,
            timer,
          });
          socket.send(`sub ${id} ${JSON.stringify({ type, ...params })}`);
        });
      },
      close() {
        failAll();
        socket.close();
      },
    };

    socket.onopen = () => {
      socket.send(
        `connect 31 ${JSON.stringify({
          locale: 'en',
          platformId: 'webtrading',
          platformVersion: 'NeoBudget',
          clientId: 'app.traderepublic.com',
          clientVersion: '1',
        })}`,
      );
    };

    socket.onmessage = event => {
      const text = typeof event.data === 'string' ? event.data : '';
      if (!connected) {
        if (text.startsWith('connected')) {
          connected = true;
          clearTimeout(connectTimer);
          resolve(session);
        }
        return;
      }

      const match = /^(\d+) ([ADCE])(?: ([\s\S]*))?$/.exec(text);
      if (!match) {
        return;
      }
      const [, id, kind, payload] = match;
      const request = pending.get(id);
      if (!request || kind === 'D') {
        return;
      }
      clearTimeout(request.timer);
      pending.delete(id);
      // One payload is enough: stop listening for updates
      socket.send(`unsub ${id}`);
      if (kind === 'A') {
        try {
          request.resolve(JSON.parse(payload ?? ''));
        } catch {
          request.reject(tradeRepublicError('unavailable'));
        }
      } else {
        request.reject(tradeRepublicError('unavailable'));
      }
    };

    socket.onerror = () => {
      clearTimeout(connectTimer);
      failAll();
      if (!connected) {
        reject(tradeRepublicError('unavailable'));
      }
    };
    socket.onclose = () => {
      clearTimeout(connectTimer);
      failAll();
      if (!connected) {
        reject(tradeRepublicError('unavailable'));
      }
    };
  });
}

export type TimelineEntry = {
  item: Record<string, unknown>;
  detail: Record<string, unknown> | null;
};

// Downloads every timeline item and, for those `needsDetail` picks, its
// detail page, which holds the shares, price, fees and taxes.
// UNVERIFIED: the `items` and `cursors.after` fields of the timeline
// pages and the `after` and `id` parameters.
export async function downloadTimeline(
  deps: TradeRepublicDeps,
  cookies: string,
  needsDetail: (item: Record<string, unknown>) => boolean,
): Promise<TimelineEntry[]> {
  const session = await openTimelineSession(deps, cookies);
  try {
    const items: Record<string, unknown>[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_TIMELINE_PAGES; page++) {
      const data = await session.read(
        'timelineTransactions',
        after ? { after } : {},
      );
      if (!isRecord(data) || !Array.isArray(data.items)) {
        throw tradeRepublicError('unavailable');
      }
      items.push(...data.items.filter(isRecord));
      const cursor = isRecord(data.cursors) ? data.cursors.after : null;
      if (
        typeof cursor !== 'string' ||
        cursor === '' ||
        cursor === after ||
        data.items.length === 0 ||
        items.length >= MAX_TIMELINE_ITEMS
      ) {
        break;
      }
      after = cursor;
    }

    const entries: TimelineEntry[] = [];
    for (const item of items) {
      let detail: Record<string, unknown> | null = null;
      if (needsDetail(item) && typeof item.id === 'string') {
        // A missing detail leaves the item to be counted as skipped
        // instead of failing the whole import
        const data = await session
          .read('timelineDetailV2', { id: item.id })
          .catch(() => null);
        detail = isRecord(data) ? data : null;
      }
      entries.push({ item, detail });
    }
    return entries;
  } finally {
    session.close();
  }
}
