import { createApp } from '#server/app';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';
import { parseSymbols, toCsv } from '#shared/csv-export';
import {
  returnCurve,
  sumByMonth,
  timeWeightedReturn,
} from '#shared/investment-performance';
import type { PerformancePoint } from '#shared/investment-performance';
import { computePosition, valuePosition } from '#shared/investments';
import { currentDay, subDays } from '#shared/months';
import type {
  InvestmentAssetEntity,
  InvestmentPositionEntity,
  InvestmentTradeEntity,
} from '#types/models';

import {
  getBrokersStatus,
  importTrades,
  syncBroker,
  tradeRepublicImport,
  tradeRepublicLogin,
} from './brokers';
import * as investmentsDb from './db';
import { parseTradesCsv } from './import-csv';
import { refreshPrices } from './prices';

export type InvestmentsHandlers = {
  'investment-assets-get': typeof getAssets;
  'investment-asset-create': typeof createAsset;
  'investment-asset-update': typeof updateAsset;
  'investment-asset-delete': typeof deleteAsset;
  'investment-trades-get': typeof getTrades;
  'investment-trade-create': typeof createTrade;
  'investment-trade-update': typeof updateTrade;
  'investment-trade-delete': typeof deleteTrade;
  'investment-price-set': typeof setPrice;
  'investment-fx-rate-set': typeof setFxRate;
  'investment-prices-refresh': typeof refreshPrices;
  'investment-brokers-status': typeof getBrokersStatus;
  'investment-broker-sync': typeof syncBroker;
  'investment-traderepublic-login': typeof tradeRepublicLogin;
  'investment-traderepublic-import': typeof tradeRepublicImport;
  'investment-import-csv': typeof importCsv;
  'investment-positions-get': typeof getPositions;
  'investment-value-history': typeof getValueHistory;
  'investment-performance': typeof getPerformance;
  'investment-price-history': typeof getPriceHistory;
  'investment-watchlist-import': typeof importWatchlist;
  'investment-export-csv': typeof exportCsv;
};

export const app = createApp<InvestmentsHandlers>();
app.method('investment-assets-get', getAssets);
app.method('investment-asset-create', mutator(undoable(createAsset)));
app.method('investment-asset-update', mutator(undoable(updateAsset)));
app.method('investment-asset-delete', mutator(undoable(deleteAsset)));
app.method('investment-trades-get', getTrades);
app.method('investment-trade-create', mutator(undoable(createTrade)));
app.method('investment-trade-update', mutator(undoable(updateTrade)));
app.method('investment-trade-delete', mutator(undoable(deleteTrade)));
app.method('investment-price-set', mutator(setPrice));
app.method('investment-fx-rate-set', mutator(setFxRate));
app.method('investment-prices-refresh', mutator(refreshPrices));
app.method('investment-brokers-status', getBrokersStatus);
app.method('investment-broker-sync', mutator(syncBroker));
app.method('investment-traderepublic-login', tradeRepublicLogin);
app.method('investment-traderepublic-import', mutator(tradeRepublicImport));
app.method('investment-import-csv', mutator(importCsv));
app.method('investment-positions-get', getPositions);
app.method('investment-value-history', getValueHistory);
app.method('investment-performance', getPerformance);
app.method('investment-price-history', getPriceHistory);
app.method('investment-watchlist-import', mutator(importWatchlist));
app.method('investment-export-csv', exportCsv);

async function getPriceHistory({
  assetId,
  days = 90,
}: {
  assetId: InvestmentAssetEntity['id'];
  days?: number;
}): Promise<{ date: string; price: number }[]> {
  return investmentsDb.getPriceHistory(assetId, subDays(currentDay(), days));
}

async function getAssets(): Promise<InvestmentAssetEntity[]> {
  return investmentsDb.getAssets();
}

async function createAsset(
  asset: Omit<Partial<InvestmentAssetEntity>, 'id'> &
    Pick<InvestmentAssetEntity, 'symbol' | 'name' | 'currency'>,
): Promise<InvestmentAssetEntity['id']> {
  return investmentsDb.insertAsset(asset);
}

async function updateAsset(
  asset: Partial<InvestmentAssetEntity> & Pick<InvestmentAssetEntity, 'id'>,
): Promise<void> {
  await investmentsDb.updateAsset(asset);
}

async function deleteAsset({
  id,
}: Pick<InvestmentAssetEntity, 'id'>): Promise<void> {
  await investmentsDb.deleteAsset(id);
}

async function getTrades(
  filter: {
    assetId?: InvestmentAssetEntity['id'];
    accountId?: InvestmentTradeEntity['account_id'];
  } = {},
): Promise<InvestmentTradeEntity[]> {
  return investmentsDb.getTrades(filter);
}

async function createTrade(
  trade: Omit<Partial<InvestmentTradeEntity>, 'id'> &
    Pick<
      InvestmentTradeEntity,
      'asset_id' | 'date' | 'type' | 'quantity' | 'price'
    >,
): Promise<InvestmentTradeEntity['id']> {
  return investmentsDb.insertTrade(trade);
}

async function updateTrade(
  trade: Partial<InvestmentTradeEntity> & Pick<InvestmentTradeEntity, 'id'>,
): Promise<void> {
  await investmentsDb.updateTrade(trade);
}

async function deleteTrade({
  id,
}: Pick<InvestmentTradeEntity, 'id'>): Promise<void> {
  await investmentsDb.deleteTrade(id);
}

async function setPrice(price: investmentsDb.PriceInput): Promise<void> {
  await investmentsDb.setPrices([price]);
}

async function setFxRate(rate: investmentsDb.FxRateInput): Promise<void> {
  await investmentsDb.setFxRates([rate]);
}

async function getBaseFigures(
  asset: InvestmentAssetEntity,
  trades: InvestmentTradeEntity[],
  quantity: number,
  price: number | null,
  baseCurrency: string,
): Promise<InvestmentPositionEntity['base']> {
  // The rate stored on a trade is what the broker applied, so it wins
  // over the daily rate
  const rates = new Map<InvestmentTradeEntity['id'], number>();
  for (const trade of trades) {
    const rate =
      trade.fx_rate ??
      (await investmentsDb.getFxRate(asset.currency, baseCurrency, trade.date));
    if (rate == null) {
      return null;
    }
    rates.set(trade.id, rate);
  }

  const position = computePosition(trades, trade => rates.get(trade.id) ?? 1);
  const currentRate = await investmentsDb.getFxRate(
    asset.currency,
    baseCurrency,
  );
  const marketValue =
    price == null || currentRate == null
      ? null
      : quantity * price * currentRate;

  return {
    currency: baseCurrency,
    costBasis: position.costBasis,
    realizedGain: position.realizedGain,
    income: position.income,
    marketValue,
    unrealizedGain:
      marketValue == null ? null : marketValue - position.costBasis,
  };
}

async function getPositions({
  accountId,
  baseCurrency,
}: {
  accountId?: InvestmentTradeEntity['account_id'];
  baseCurrency?: string;
} = {}): Promise<InvestmentPositionEntity[]> {
  const assets = await investmentsDb.getAssets();
  const trades = await investmentsDb.getTrades({ accountId });

  const tradesByAsset = new Map<
    InvestmentAssetEntity['id'],
    InvestmentTradeEntity[]
  >();
  for (const trade of trades) {
    const list = tradesByAsset.get(trade.asset_id);
    if (list) {
      list.push(trade);
    } else {
      tradesByAsset.set(trade.asset_id, [trade]);
    }
  }

  const positions: InvestmentPositionEntity[] = [];
  for (const asset of assets) {
    const assetTrades = tradesByAsset.get(asset.id);
    if (!assetTrades) {
      continue;
    }

    const position = computePosition(assetTrades);
    const valuation = valuePosition(
      position,
      await investmentsDb.getLatestPrice(asset.id),
    );

    positions.push({
      asset,
      accountIds: [
        ...new Set(
          assetTrades.flatMap(trade =>
            trade.account_id ? [trade.account_id] : [],
          ),
        ),
      ],
      ...position,
      ...valuation,
      base: baseCurrency
        ? await getBaseFigures(
            asset,
            assetTrades,
            position.quantity,
            valuation.price,
            baseCurrency.toUpperCase(),
          )
        : null,
    });
  }

  return positions;
}

// Assets count from their first day with price and rate, so gaps do not show as drops.
async function getValueHistory({
  baseCurrency,
  days = 90,
  points = 30,
}: {
  baseCurrency: string;
  days?: number;
  points?: number;
}): Promise<{ date: string; value: number }[]> {
  const base = baseCurrency.toUpperCase();
  const assets = await investmentsDb.getAssets();
  const trades = await investmentsDb.getTrades();

  const tradesByAsset = new Map<
    InvestmentAssetEntity['id'],
    InvestmentTradeEntity[]
  >();
  for (const trade of trades) {
    const list = tradesByAsset.get(trade.asset_id) ?? [];
    list.push(trade);
    tradesByAsset.set(trade.asset_id, list);
  }

  const today = currentDay();
  const step = Math.max(1, Math.floor(days / Math.max(points - 1, 1)));
  const history: { date: string; value: number }[] = [];

  for (let offset = days; offset >= 0; offset -= step) {
    const date = subDays(today, offset);
    let value = 0;
    let hasValue = false;

    for (const asset of assets) {
      const held = (tradesByAsset.get(asset.id) ?? []).filter(
        trade => trade.date <= date,
      );
      if (held.length === 0) {
        continue;
      }
      const { quantity } = computePosition(held);
      if (quantity === 0) {
        continue;
      }
      const quote = await investmentsDb.getLatestPrice(asset.id, date);
      const rate = await investmentsDb.getFxRate(asset.currency, base, date);
      if (!quote || rate == null) {
        continue;
      }
      value += quantity * quote.price * rate;
      hasValue = true;
    }

    if (hasValue) {
      history.push({ date, value });
    }
  }

  return history;
}

// Trades without a rate on their day are left out, like in the value history.
async function getPerformance({
  baseCurrency,
  days = 365,
  points: pointCount = 24,
  benchmarkAssetId,
}: {
  baseCurrency: string;
  days?: number;
  points?: number;
  benchmarkAssetId?: string;
}) {
  const base = baseCurrency.toUpperCase();
  const assets = await investmentsDb.getAssets();
  const trades = await investmentsDb.getTrades();
  const assetById = new Map(assets.map(asset => [asset.id, asset]));

  type Flow = { date: string; flow: number; income: number; assetId: string };
  const flows: Flow[] = [];
  for (const trade of trades) {
    const asset = assetById.get(trade.asset_id);
    if (!asset) {
      continue;
    }
    const rate =
      asset.currency.toUpperCase() === base
        ? 1
        : await investmentsDb.getFxRate(asset.currency, base, trade.date);
    if (rate == null) {
      continue;
    }
    const amount = trade.quantity * trade.price * rate;
    const fee = (trade.fee || 0) * rate;
    if (trade.type === 'buy') {
      flows.push({
        date: trade.date,
        flow: amount + fee,
        income: 0,
        assetId: asset.id,
      });
    } else if (trade.type === 'sell') {
      flows.push({
        date: trade.date,
        flow: -(amount - fee),
        income: 0,
        assetId: asset.id,
      });
    } else if (trade.type === 'dividend') {
      flows.push({
        date: trade.date,
        flow: 0,
        income: amount - fee,
        assetId: asset.id,
      });
    }
  }

  const history = await getValueHistory({
    baseCurrency: base,
    days,
    points: pointCount,
  });
  const start = history.length > 0 ? history[0].date : currentDay();

  const series: PerformancePoint[] = history.map((point, index) => {
    const previous = index === 0 ? null : history[index - 1].date;
    const inPeriod = flows.filter(
      item =>
        item.date <= point.date && (previous ? item.date > previous : false),
    );
    return {
      date: point.date,
      value: point.value,
      flow: inPeriod.reduce((total, item) => total + item.flow, 0),
      income: inPeriod.reduce((total, item) => total + item.income, 0),
    };
  });

  const dividends = flows.filter(
    item => item.income !== 0 && item.date >= start,
  );
  const dividendsByAsset = new Map<string, number>();
  for (const item of dividends) {
    dividendsByAsset.set(
      item.assetId,
      (dividendsByAsset.get(item.assetId) ?? 0) + item.income,
    );
  }

  const contributed = series
    .slice(1)
    .reduce((total, point) => total + point.flow, 0);
  const startValue = series.length > 0 ? series[0].value : 0;
  const endValue = series.length > 0 ? series[series.length - 1].value : 0;
  const income = dividends.reduce((total, item) => total + item.income, 0);

  const curve = returnCurve(series);
  const benchmarkCurve: { date: string; value: number }[] = [];
  if (benchmarkAssetId && curve.length > 0) {
    const first = await investmentsDb.getLatestPrice(
      benchmarkAssetId,
      curve[0].date,
    );
    if (first && first.price > 0) {
      for (const point of curve) {
        const quote = await investmentsDb.getLatestPrice(
          benchmarkAssetId,
          point.date,
        );
        if (quote) {
          benchmarkCurve.push({
            date: point.date,
            value: (quote.price / first.price - 1) * 100,
          });
        }
      }
    }
  }

  return {
    twr: timeWeightedReturn(series),
    curve,
    benchmarkCurve,
    startValue,
    endValue,
    contributed,
    gain: endValue - startValue - contributed,
    income,
    dividendsByMonth: sumByMonth(
      dividends.map(item => ({ date: item.date, amount: item.income })),
    ),
    dividendsByAsset: [...dividendsByAsset.entries()]
      .map(([assetId, amount]) => ({
        assetId,
        name: assetById.get(assetId)?.name ?? assetId,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

async function importWatchlist({
  text,
  defaultCurrency = 'EUR',
}: {
  text: string;
  defaultCurrency?: string;
}) {
  const symbols = parseSymbols(text);
  const assets = await investmentsDb.getAssets();
  const bySymbol = new Map(
    assets.map(asset => [asset.symbol.toUpperCase(), asset]),
  );
  let added = 0;
  let existing = 0;

  for (const symbol of symbols) {
    const asset = bySymbol.get(symbol);
    if (asset) {
      existing++;
      if (!asset.watched) {
        await investmentsDb.updateAsset({ id: asset.id, watched: 1 });
      }
      continue;
    }
    await investmentsDb.insertAsset({
      symbol,
      name: symbol,
      type: 'stock',
      currency: defaultCurrency,
      price_source: 'yahoo',
      price_source_id: symbol,
      watched: 1,
    });
    added++;
  }

  return { added, existing };
}

async function exportCsv({
  kind,
}: {
  kind: 'trades' | 'watchlist';
}): Promise<string> {
  const assets = await investmentsDb.getAssets();
  if (kind === 'watchlist') {
    return toCsv(
      ['symbol', 'name', 'type', 'currency'],
      assets
        .filter(asset => asset.watched)
        .map(asset => [asset.symbol, asset.name, asset.type, asset.currency]),
    );
  }
  const bySymbol = new Map(assets.map(asset => [asset.id, asset]));
  const trades = await investmentsDb.getTrades();
  return toCsv(
    ['date', 'type', 'symbol', 'name', 'quantity', 'price', 'fee', 'currency'],
    trades.map(trade => {
      const asset = bySymbol.get(trade.asset_id);
      return [
        trade.date,
        trade.type,
        asset?.symbol,
        asset?.name,
        trade.quantity,
        trade.price,
        trade.fee,
        asset?.currency,
      ];
    }),
  );
}

// Re-importing the same file adds nothing.
async function importCsv({
  text,
  accountId = null,
  defaultCurrency = 'EUR',
}: {
  text: string;
  accountId?: InvestmentTradeEntity['account_id'];
  defaultCurrency?: string;
}) {
  const result = { imported: 0, duplicates: 0, assetsCreated: 0 };
  let parsed;
  try {
    parsed = parseTradesCsv(text, defaultCurrency);
  } catch {
    return {
      ...result,
      rejected: [{ line: 0, reason: 'The file is not a valid CSV' }],
    };
  }
  await importTrades(parsed.trades, accountId, result);
  return { ...result, rejected: parsed.rejected };
}
