import { clearCache, fetchQuotes } from './providers';
import type { AssetQuotes, PriceSource } from './providers';

// Optional: refreshes quotes of requested symbols every N minutes (ACTUAL_PRICES_REFRESH_MINUTES > 0).

const MAX_TRACKED = 500;

type Tracked = {
  source: PriceSource;
  id: string;
  currency: string;
  days: number;
};
type Entry = Tracked & { result: AssetQuotes | null; updatedAt: number };

const tracked = new Map<string, Entry>();
let timer: ReturnType<typeof setInterval> | null = null;
let enabled = false;

const keyOf = (asset: Tracked) =>
  `${asset.source}|${asset.id}|${asset.currency}|${asset.days}`;

export function parseRefreshMinutes(value: string | undefined): number | null {
  if (value == null || value.trim() === '') {
    return null;
  }
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export function isRefreshJobEnabled(): boolean {
  return enabled;
}

// Oldest symbols are dropped at the limit.
export function trackAsset(asset: Tracked) {
  if (!enabled) {
    return;
  }
  const key = keyOf(asset);
  if (tracked.has(key)) {
    return;
  }
  if (tracked.size >= MAX_TRACKED) {
    const oldest = tracked.keys().next().value;
    if (oldest !== undefined) {
      tracked.delete(oldest);
    }
  }
  tracked.set(key, { ...asset, result: null, updatedAt: 0 });
}

export function getCachedQuotes(asset: Tracked): AssetQuotes | null {
  return enabled ? (tracked.get(keyOf(asset))?.result ?? null) : null;
}

export async function refreshTracked(): Promise<void> {
  // The provider layer keeps its own short cache; start from scratch so
  // the job really asks for new prices
  clearCache();
  for (const entry of tracked.values()) {
    try {
      entry.result = await fetchQuotes(
        entry.source,
        entry.id,
        entry.currency,
        entry.days,
      );
      entry.updatedAt = Date.now();
    } catch {
      // Keep the last good result; the next cycle tries again
    }
  }
}

export function startRefreshJob(
  minutesValue = process.env.ACTUAL_PRICES_REFRESH_MINUTES,
) {
  stopRefreshJob();
  const minutes = parseRefreshMinutes(minutesValue);
  if (minutes == null) {
    return false;
  }
  enabled = true;
  timer = setInterval(() => void refreshTracked(), minutes * 60 * 1000);
  timer.unref();
  return true;
}

export function stopRefreshJob() {
  if (timer) {
    clearInterval(timer);
  }
  timer = null;
  enabled = false;
  tracked.clear();
}
