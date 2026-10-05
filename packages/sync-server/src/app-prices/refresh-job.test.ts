import * as providers from './providers';
import {
  getCachedQuotes,
  isRefreshJobEnabled,
  parseRefreshMinutes,
  refreshTracked,
  startRefreshJob,
  stopRefreshJob,
  trackAsset,
} from './refresh-job';

const asset = {
  source: 'yahoo',
  id: 'AAPL',
  currency: 'USD',
  days: 5,
} as const;

afterEach(() => {
  stopRefreshJob();
  vi.restoreAllMocks();
});

describe('parseRefreshMinutes', () => {
  it('only accepts positive numbers', () => {
    expect(parseRefreshMinutes(undefined)).toBeNull();
    expect(parseRefreshMinutes('')).toBeNull();
    expect(parseRefreshMinutes('abc')).toBeNull();
    expect(parseRefreshMinutes('0')).toBeNull();
    expect(parseRefreshMinutes('-5')).toBeNull();
    expect(parseRefreshMinutes('15')).toBe(15);
  });
});

describe('refresh job', () => {
  it('is disabled by default', () => {
    expect(startRefreshJob(undefined)).toBe(false);
    expect(isRefreshJobEnabled()).toBe(false);
    trackAsset(asset);
    expect(getCachedQuotes(asset)).toBeNull();
  });

  it('refreshes the tracked symbols and serves them from memory', async () => {
    const quotes = {
      currency: 'USD',
      quotes: [{ date: '2026-10-01', price: 1 }],
    };
    const fetch = vi.spyOn(providers, 'fetchQuotes').mockResolvedValue(quotes);

    expect(startRefreshJob('10')).toBe(true);
    trackAsset(asset);
    expect(getCachedQuotes(asset)).toBeNull();

    await refreshTracked();

    expect(fetch).toHaveBeenCalledWith('yahoo', 'AAPL', 'USD', 5);
    expect(getCachedQuotes(asset)).toEqual(quotes);
  });

  it('keeps the last good result when a refresh fails', async () => {
    const quotes = {
      currency: 'USD',
      quotes: [{ date: '2026-10-01', price: 1 }],
    };
    const fetch = vi
      .spyOn(providers, 'fetchQuotes')
      .mockResolvedValueOnce(quotes)
      .mockRejectedValueOnce(new Error('rate limited'));

    startRefreshJob('10');
    trackAsset(asset);
    await refreshTracked();
    await refreshTracked();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(getCachedQuotes(asset)).toEqual(quotes);
  });
});
