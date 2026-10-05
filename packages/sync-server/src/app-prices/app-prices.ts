import express from 'express';

import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

import { fetchFxRates, fetchQuotes, PRICE_SOURCES } from './providers';
import type { PriceSource, Quote } from './providers';
import { getCachedQuotes, trackAsset } from './refresh-job';

const MAX_ASSETS = 200;
const MAX_DAYS = 3650;

type QuotesResult = {
  source: string;
  id: string;
  currency?: string;
  quotes?: Quote[];
  error?: string;
};

const app = express();
export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(validateSessionMiddleware);

function parseDays(value: unknown): number {
  const days = typeof value === 'number' ? Math.floor(value) : 1;
  return Math.min(Math.max(days, 1), MAX_DAYS);
}

function isPriceSource(value: unknown): value is PriceSource {
  return PRICE_SOURCES.some(source => source === value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

app.post('/quotes', async (req, res) => {
  const { assets, days } = req.body ?? {};
  if (!Array.isArray(assets) || assets.length > MAX_ASSETS) {
    res.send({ status: 'error', reason: 'invalid-assets' });
    return;
  }

  // One asset failing (unknown symbol, rate limit) must not hide the
  // prices of the others
  const data: QuotesResult[] = [];
  for (const asset of assets) {
    const source: unknown = asset?.source;
    const id: unknown = asset?.id;
    const currency: unknown = asset?.currency;
    const result: QuotesResult = { source: String(source), id: String(id) };

    if (
      !isPriceSource(source) ||
      typeof id !== 'string' ||
      typeof currency !== 'string'
    ) {
      data.push({ ...result, error: 'Invalid price source, id or currency' });
      continue;
    }

    try {
      const asset = { source, id, currency, days: parseDays(days) };
      trackAsset(asset);
      data.push({
        ...result,
        ...(getCachedQuotes(asset) ??
          (await fetchQuotes(source, id, currency, asset.days))),
      });
    } catch (error) {
      data.push({ ...result, error: errorMessage(error) });
    }
  }

  res.send({ status: 'ok', data });
});

app.post('/fx-rates', async (req, res) => {
  try {
    res.send({
      status: 'ok',
      data: await fetchFxRates(parseDays(req.body?.days)),
    });
  } catch (error) {
    res.send({ status: 'error', reason: errorMessage(error) });
  }
});
