// In-memory only. The PIN never reaches this module; only the TR process id is kept, 5 minutes, single use.

import { randomUUID } from 'node:crypto';

export const PENDING_LOGIN_TTL_MS = 5 * 60 * 1000;
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
// Caps the memory a flood of logins could take
const MAX_PENDING_LOGINS = 100;
const SWEEP_INTERVAL_MS = 60 * 1000;

type Clock = () => number;

type PendingLogin = {
  owner: string;
  trProcessId: string;
  expiresAt: number;
};

export type PendingLogins = {
  // Returns the handle the browser gets instead of TR's own process id
  add(owner: string, trProcessId: string): string;
  // The TR process id, or null when unknown, expired or someone else's.
  // A handle works once: it is gone after this call.
  take(handle: string, owner: string): string | null;
  size(): number;
  dispose(): void;
};

export function createPendingLogins(now: Clock = Date.now): PendingLogins {
  const entries = new Map<string, PendingLogin>();

  function sweep() {
    const time = now();
    for (const [handle, entry] of entries) {
      if (entry.expiresAt <= time) {
        entries.delete(handle);
      }
    }
  }

  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  timer.unref?.();

  return {
    add(owner, trProcessId) {
      sweep();
      // One login in progress per user is enough
      for (const [handle, entry] of entries) {
        if (entry.owner === owner) {
          entries.delete(handle);
        }
      }
      while (entries.size >= MAX_PENDING_LOGINS) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        entries.delete(oldest);
      }
      const handle = randomUUID();
      entries.set(handle, {
        owner,
        trProcessId,
        expiresAt: now() + PENDING_LOGIN_TTL_MS,
      });
      return handle;
    },
    take(handle, owner) {
      sweep();
      const entry = entries.get(handle);
      if (!entry || entry.owner !== owner) {
        return null;
      }
      entries.delete(handle);
      return entry.trProcessId;
    },
    size() {
      sweep();
      return entries.size;
    },
    dispose() {
      clearInterval(timer);
      entries.clear();
    },
  };
}

export type AttemptLimiter = {
  // Records an attempt for every key, unless one of them is already at
  // the limit, in which case nothing is recorded and false is returned
  tryConsume(keys: string[]): boolean;
};

export function createAttemptLimiter({
  max = MAX_ATTEMPTS,
  windowMs = ATTEMPT_WINDOW_MS,
  now = Date.now,
}: { max?: number; windowMs?: number; now?: Clock } = {}): AttemptLimiter {
  const hits = new Map<string, number[]>();

  return {
    tryConsume(keys) {
      const time = now();
      for (const [key, times] of hits) {
        const recent = times.filter(t => t > time - windowMs);
        if (recent.length === 0) {
          hits.delete(key);
        } else {
          hits.set(key, recent);
        }
      }
      if (keys.some(key => (hits.get(key)?.length ?? 0) >= max)) {
        return false;
      }
      for (const key of keys) {
        hits.set(key, [...(hits.get(key) ?? []), time]);
      }
      return true;
    },
  };
}

// Spaces and dashes in the phone number are dropped; the rest must match exactly.
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const FOUR_DIGITS = /^\d{4}$/;
const HANDLE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLoginInput(
  body: unknown,
): { phone: string; pin: string } | null {
  if (!isRecord(body)) {
    return null;
  }
  const { phone, pin } = body;
  if (
    typeof phone !== 'string' ||
    typeof pin !== 'string' ||
    phone.length > 24 ||
    !FOUR_DIGITS.test(pin)
  ) {
    return null;
  }
  const normalized = phone.replace(/[\s-]/g, '');
  return PHONE_PATTERN.test(normalized) ? { phone: normalized, pin } : null;
}

export function parseVerifyInput(
  body: unknown,
): { processId: string; code: string } | null {
  if (!isRecord(body)) {
    return null;
  }
  const { processId, code } = body;
  if (
    typeof processId !== 'string' ||
    typeof code !== 'string' ||
    !HANDLE_PATTERN.test(processId) ||
    !FOUR_DIGITS.test(code)
  ) {
    return null;
  }
  return { processId, code };
}
