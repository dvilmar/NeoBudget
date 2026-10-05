export type Quote = { date: string; price: number };
export type AssetQuotes = { currency: string; quotes: Quote[] };
export type FxRate = {
  base: string;
  quote: string;
  date: string;
  rate: number;
};

export const PRICE_SOURCES = ['yahoo', 'coingecko'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20 * 1000;
const DAY_SECONDS = 24 * 60 * 60;
const COINGECKO_MAX_DAYS = 365;

// Some exchanges quote in a hundredth of the currency (London in pence)
const MINOR_UNIT_CURRENCIES: Record<string, string> = {
  GBp: 'GBP',
  GBX: 'GBP',
  ZAc: 'ZAR',
  ILA: 'ILS',
};

const cache = new Map<string, { expires: number; body: string }>();

export function clearCache() {
  cache.clear();
}

// The providers are free and rate limited, so identical requests within
// a few minutes are answered from memory
async function fetchText(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.body;
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeoBudget)' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await res.text();
  if (res.status === 404) {
    throw new Error('Not found in the price source');
  }
  if (!res.ok) {
    throw new Error(`${new URL(url).hostname} responded with ${res.status}`);
  }

  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, body });
  return body;
}

function toDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSortedQuotes(byDate: Map<string, number>): Quote[] {
  return [...byDate]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function parseYahooChart(json: unknown): AssetQuotes {
  const chart = isRecord(json) && isRecord(json.chart) ? json.chart : null;
  const result =
    chart && Array.isArray(chart.result) && isRecord(chart.result[0])
      ? chart.result[0]
      : null;
  const meta = result && isRecord(result.meta) ? result.meta : null;
  if (!result || !meta || typeof meta.currency !== 'string') {
    const description =
      chart && isRecord(chart.error) ? chart.error.description : null;
    throw new Error(
      typeof description === 'string' ? description : 'No data for this symbol',
    );
  }

  const factor = meta.currency in MINOR_UNIT_CURRENCIES ? 0.01 : 1;
  // Bars are stamped with the exchange opening time, so the trading day
  // has to be read in the exchange time zone
  const offset = typeof meta.gmtoffset === 'number' ? meta.gmtoffset : 0;
  const byDate = new Map<string, number>();

  const timestamps: unknown[] = Array.isArray(result.timestamp)
    ? result.timestamp
    : [];
  const indicators = isRecord(result.indicators) ? result.indicators : null;
  const series =
    indicators &&
    Array.isArray(indicators.quote) &&
    isRecord(indicators.quote[0])
      ? indicators.quote[0]
      : null;
  const closes: unknown[] =
    series && Array.isArray(series.close) ? series.close : [];

  timestamps.forEach((timestamp, index) => {
    const close = closes[index];
    if (typeof timestamp === 'number' && typeof close === 'number') {
      byDate.set(toDate(timestamp + offset), close * factor);
    }
  });

  if (
    typeof meta.regularMarketPrice === 'number' &&
    typeof meta.regularMarketTime === 'number'
  ) {
    byDate.set(
      toDate(meta.regularMarketTime + offset),
      meta.regularMarketPrice * factor,
    );
  }

  return {
    currency:
      MINOR_UNIT_CURRENCIES[meta.currency] ?? meta.currency.toUpperCase(),
    quotes: toSortedQuotes(byDate),
  };
}

export function parseCoinGeckoChart(
  json: unknown,
  currency: string,
): AssetQuotes {
  if (!isRecord(json) || !Array.isArray(json.prices)) {
    const message =
      isRecord(json) && typeof json.error === 'string' ? json.error : null;
    throw new Error(message ?? 'No data for this coin');
  }

  // Points come in time order, so the last one of each day is its close
  const byDate = new Map<string, number>();
  for (const point of json.prices) {
    if (
      Array.isArray(point) &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number'
    ) {
      byDate.set(toDate(point[0] / 1000), point[1]);
    }
  }

  return { currency: currency.toUpperCase(), quotes: toSortedQuotes(byDate) };
}

// The ECB publishes how many units of each currency one euro buys
export function parseEcbRates(xml: string): FxRate[] {
  const rates: FxRate[] = [];
  const days = xml.split(/<Cube\s+time=/).slice(1);
  for (const day of days) {
    const date = /^['"](\d{4}-\d{2}-\d{2})['"]/.exec(day)?.[1];
    if (!date) {
      continue;
    }
    const pattern = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;
    for (const match of day.matchAll(pattern)) {
      const rate = Number(match[2]);
      if (rate > 0) {
        rates.push({ base: 'EUR', quote: match[1], date, rate });
      }
    }
  }
  return rates;
}

export async function fetchQuotes(
  source: PriceSource,
  id: string,
  currency: string,
  days: number,
): Promise<AssetQuotes> {
  switch (source) {
    case 'yahoo': {
      const now = Math.floor(Date.now() / 1000);
      // A week of margin covers weekends and holidays
      const from = now - (days + 7) * DAY_SECONDS;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(id)}?period1=${from}&period2=${now}&interval=1d`;
      return parseYahooChart(JSON.parse(await fetchText(url)));
    }
    case 'coingecko': {
      // The free API refuses anything older than a year
      const range = Math.min(days, COINGECKO_MAX_DAYS);
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${encodeURIComponent(currency.toLowerCase())}&days=${range}`;
      return parseCoinGeckoChart(JSON.parse(await fetchText(url)), currency);
    }
    default:
      throw new Error(`Unknown price source: ${String(source)}`);
  }
}

export async function fetchFxRates(days: number): Promise<FxRate[]> {
  const file =
    days <= 1
      ? 'eurofxref-daily.xml'
      : days <= 90
        ? 'eurofxref-hist-90d.xml'
        : 'eurofxref-hist.xml';
  const rates = parseEcbRates(
    await fetchText(`https://www.ecb.europa.eu/stats/eurofxref/${file}`),
  );

  const since = toDate(Date.now() / 1000 - (days + 7) * DAY_SECONDS);
  return rates.filter(rate => rate.date >= since);
}
