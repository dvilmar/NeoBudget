import * as asyncStorage from '#platform/server/asyncStorage';
import { post } from '#server/post';
import { getServer } from '#server/server-config';
import { currentDay, differenceInCalendarDays } from '#shared/months';
import type { InvestmentAssetEntity } from '#types/models';

import * as investmentsDb from './db';

type ServerQuotes = {
  currency?: string;
  quotes?: Array<{ date: string; price: number }>;
  error?: string;
};

export type PriceRefreshResult = {
  updated: number;
  fxRates: number;
  errors: Array<{
    assetId: InvestmentAssetEntity['id'] | null;
    symbol: string | null;
    message: string;
  }>;
};

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    return String(error.reason);
  }
  return String(error);
}

const MAX_DAYS = 3650;

// Reach the oldest missing price so a device that was off catches up in one go.
async function getDaysToFill(): Promise<number> {
  const since = await investmentsDb.getOldestPriceGap();
  if (!since) {
    return 1;
  }
  const days = differenceInCalendarDays(currentDay(), since) + 1;
  return Math.min(Math.max(days, 1), MAX_DAYS);
}

// `days` omitted covers everything missing since the last refresh.
export async function refreshPrices({
  days: requestedDays,
}: { days?: number } = {}): Promise<PriceRefreshResult> {
  const days = requestedDays ?? (await getDaysToFill());
  const result: PriceRefreshResult = { updated: 0, fxRates: 0, errors: [] };
  const userToken = await asyncStorage.getItem('user-token');
  const server = getServer();
  if (!userToken || !server) {
    // Not having a server is a normal setup, not a failure of the app
    result.errors.push({
      assetId: null,
      symbol: null,
      message: 'A sync server is needed to download prices',
    });
    return result;
  }

  const url = server.BASE_SERVER.replace(/\/+$/, '') + '/prices';
  const headers = { 'X-ACTUAL-TOKEN': userToken };

  const assets = (await investmentsDb.getAssets()).filter(
    asset => asset.price_source && asset.price_source_id,
  );

  if (assets.length > 0) {
    let answers: ServerQuotes[];
    try {
      answers = await post(
        url + '/quotes',
        {
          assets: assets.map(asset => ({
            source: asset.price_source,
            id: asset.price_source_id,
            currency: asset.currency,
          })),
          days,
        },
        headers,
        REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      result.errors.push({
        assetId: null,
        symbol: null,
        message: `Prices: ${errorMessage(error)}`,
      });
      return result;
    }

    for (const [index, asset] of assets.entries()) {
      const answer = answers[index];
      const quotes = answer?.quotes ?? [];
      let message: string | null = null;
      if (!answer || answer.error) {
        message = answer?.error ?? 'No answer from the server';
      } else if (answer.currency !== asset.currency) {
        // Storing it would value the position in the wrong currency
        message = `Quoted in ${answer.currency}, but the asset is in ${asset.currency}`;
      } else if (quotes.length === 0) {
        message = 'No prices for this period';
      }

      if (message) {
        result.errors.push({
          assetId: asset.id,
          symbol: asset.symbol,
          message,
        });
        continue;
      }

      await investmentsDb.setPrices(
        quotes.map(quote => ({
          assetId: asset.id,
          date: quote.date,
          price: quote.price,
          source: asset.price_source ?? undefined,
        })),
      );
      result.updated++;
    }
  }

  try {
    const rates: investmentsDb.FxRateInput[] = await post(
      url + '/fx-rates',
      { days },
      headers,
      REQUEST_TIMEOUT_MS,
    );
    await investmentsDb.setFxRates(rates);
    result.fxRates = rates.length;
  } catch (error) {
    result.errors.push({
      assetId: null,
      symbol: null,
      message: `Exchange rates: ${errorMessage(error)}`,
    });
  }

  return result;
}
