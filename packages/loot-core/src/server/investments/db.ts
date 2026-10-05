import * as db from '#server/db';
import { ValidationError } from '#server/errors';
import { fromDateRepr, requiredFields, toDateRepr } from '#server/models';
import { batchMessages } from '#server/sync';
import type {
  InvestmentAssetEntity,
  InvestmentAssetType,
  InvestmentTradeEntity,
  InvestmentTradeType,
} from '#types/models';

type DbInvestmentAsset = InvestmentAssetEntity & { tombstone: 1 | 0 };

type DbInvestmentTrade = Omit<InvestmentTradeEntity, 'date'> & {
  date: number;
  tombstone: 1 | 0;
};

type DbQuote = { price: number; date: number };

const ASSET_TYPES: InvestmentAssetType[] = [
  'stock',
  'etf',
  'fund',
  'bond',
  'crypto',
  'other',
];

const TRADE_TYPES: InvestmentTradeType[] = ['buy', 'sell', 'dividend', 'fee'];

const ASSET_FIELDS = [
  'id',
  'symbol',
  'name',
  'type',
  'currency',
  'isin',
  'price_source',
  'price_source_id',
  'watched',
] as const;

const TRADE_FIELDS = [
  'id',
  'asset_id',
  'account_id',
  'date',
  'type',
  'quantity',
  'price',
  'fee',
  'fx_rate',
  'notes',
  'imported_id',
] as const;

function pick<T extends object, K extends keyof T>(
  row: T,
  fields: readonly K[],
): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const field of fields) {
    if (Object.hasOwn(row, field)) {
      result[field] = row[field];
    }
  }
  return result as Pick<T, K>;
}

function assertNotNegative(name: string, value: unknown) {
  if (value != null && !(typeof value === 'number' && value >= 0)) {
    throw new ValidationError(`${name} must be a number that is not negative`);
  }
}

function validateAsset<T extends Partial<InvestmentAssetEntity>>(
  asset: T,
  { update }: { update?: boolean } = {},
) {
  requiredFields<
    Partial<InvestmentAssetEntity>,
    'symbol' | 'name' | 'currency'
  >('investment asset', asset, ['symbol', 'name', 'currency'], update);

  const row = pick(asset, ASSET_FIELDS);
  if (row.type != null && !ASSET_TYPES.includes(row.type)) {
    throw new ValidationError(`Unknown investment asset type: ${row.type}`);
  }
  if (row.currency != null) {
    row.currency = row.currency.toUpperCase();
  }
  return row;
}

function validateTrade<T extends Partial<InvestmentTradeEntity>>(
  trade: T,
  { update }: { update?: boolean } = {},
) {
  requiredFields<
    Partial<InvestmentTradeEntity>,
    'asset_id' | 'date' | 'type' | 'quantity' | 'price'
  >(
    'investment trade',
    trade,
    ['asset_id', 'date', 'type', 'quantity', 'price'],
    update,
  );

  const { date, ...row } = pick(trade, TRADE_FIELDS);
  if (row.type != null && !TRADE_TYPES.includes(row.type)) {
    throw new ValidationError(`Unknown investment trade type: ${row.type}`);
  }
  assertNotNegative('quantity', row.quantity);
  assertNotNegative('price', row.price);
  assertNotNegative('fee', row.fee);
  if (row.fx_rate != null && !(row.fx_rate > 0)) {
    throw new ValidationError('fx_rate must be greater than zero');
  }

  return date == null ? row : { ...row, date: toDateRepr(date) };
}

function toAssetEntity(row: DbInvestmentAsset): InvestmentAssetEntity {
  const { tombstone: _tombstone, ...asset } = row;
  return asset;
}

function toTradeEntity(row: DbInvestmentTrade): InvestmentTradeEntity {
  const { tombstone: _tombstone, date, ...trade } = row;
  return { ...trade, date: fromDateRepr(date) };
}

export async function getAssets(): Promise<InvestmentAssetEntity[]> {
  const rows = await db.all<DbInvestmentAsset>(
    `SELECT * FROM investment_assets WHERE tombstone = 0 ORDER BY symbol, id`,
  );
  return rows.map(toAssetEntity);
}

export async function insertAsset(
  asset: Partial<InvestmentAssetEntity>,
): Promise<InvestmentAssetEntity['id']> {
  return db.insertWithUUID('investment_assets', {
    type: 'other',
    ...validateAsset(asset),
  });
}

export async function updateAsset(
  asset: Partial<InvestmentAssetEntity> & Pick<InvestmentAssetEntity, 'id'>,
) {
  await db.update('investment_assets', validateAsset(asset, { update: true }));
}

export async function deleteAsset(id: InvestmentAssetEntity['id']) {
  const trades = await db.all<Pick<DbInvestmentTrade, 'id'>>(
    `SELECT id FROM investment_trades WHERE asset_id = ? AND tombstone = 0`,
    [id],
  );

  await batchMessages(async () => {
    for (const trade of trades) {
      await db.delete_('investment_trades', trade.id);
    }
    await db.delete_('investment_assets', id);
  });
}

export async function getTrades({
  assetId,
  accountId,
}: {
  assetId?: InvestmentAssetEntity['id'];
  accountId?: InvestmentTradeEntity['account_id'];
} = {}): Promise<InvestmentTradeEntity[]> {
  const conditions = ['tombstone = 0'];
  const params: string[] = [];
  if (assetId) {
    conditions.push('asset_id = ?');
    params.push(assetId);
  }
  if (accountId) {
    conditions.push('account_id = ?');
    params.push(accountId);
  }

  const rows = await db.all<DbInvestmentTrade>(
    `SELECT * FROM investment_trades WHERE ${conditions.join(' AND ')} ORDER BY date, id`,
    params,
  );
  return rows.map(toTradeEntity);
}

export async function findImportedTrade(
  importedId: string,
  accountId: InvestmentTradeEntity['account_id'],
): Promise<InvestmentTradeEntity['id'] | null> {
  const row = await db.first<Pick<DbInvestmentTrade, 'id'>>(
    `SELECT id FROM investment_trades
     WHERE imported_id = ? AND IFNULL(account_id, '') = ? AND tombstone = 0 LIMIT 1`,
    [importedId, accountId ?? ''],
  );
  return row?.id ?? null;
}

export async function insertTrade(
  trade: Partial<InvestmentTradeEntity>,
): Promise<InvestmentTradeEntity['id']> {
  const row = validateTrade(trade);

  if (row.imported_id) {
    const existing = await db.first<Pick<DbInvestmentTrade, 'id'>>(
      `SELECT id FROM investment_trades
       WHERE imported_id = ? AND IFNULL(account_id, '') = ? AND tombstone = 0 LIMIT 1`,
      [row.imported_id, row.account_id ?? ''],
    );
    if (existing) {
      return existing.id;
    }
  }

  return db.insertWithUUID('investment_trades', { fee: 0, ...row });
}

export async function updateTrade(
  trade: Partial<InvestmentTradeEntity> & Pick<InvestmentTradeEntity, 'id'>,
) {
  await db.update('investment_trades', validateTrade(trade, { update: true }));
}

export async function deleteTrade(id: InvestmentTradeEntity['id']) {
  await db.delete_('investment_trades', id);
}

// Prices and rates are a local cache: written directly, not as sync messages.

export type PriceInput = {
  assetId: InvestmentAssetEntity['id'];
  date: string;
  price: number;
  source?: string;
};

export async function setPrices(prices: PriceInput[]) {
  db.transaction(() => {
    for (const { assetId, date, price, source = 'manual' } of prices) {
      assertNotNegative('price', price);
      const dateRepr = toDateRepr(date);
      db.runQuery(
        `INSERT OR REPLACE INTO investment_prices (id, asset_id, date, price, source) VALUES (?, ?, ?, ?, ?)`,
        [`${assetId}:${dateRepr}`, assetId, dateRepr, price, source],
      );
    }
  });
}

// Null when nothing needs filling.
export async function getOldestPriceGap(): Promise<string | null> {
  const rows = await db.all<{ since: number | null }>(
    `SELECT IFNULL(
       (SELECT MAX(date) FROM investment_prices p WHERE p.asset_id = a.id),
       (SELECT MIN(date) FROM investment_trades t WHERE t.asset_id = a.id AND t.tombstone = 0)
     ) AS since
     FROM investment_assets a
     WHERE a.tombstone = 0 AND a.price_source IS NOT NULL`,
  );
  const dates = rows.flatMap(row => (row.since == null ? [] : [row.since]));
  return dates.length === 0 ? null : fromDateRepr(Math.min(...dates));
}

export async function getLatestPrice(
  assetId: InvestmentAssetEntity['id'],
  onOrBefore?: string,
): Promise<{ price: number; date: string } | null> {
  const row = await db.first<DbQuote>(
    `SELECT price, date FROM investment_prices
     WHERE asset_id = ? AND date <= ? ORDER BY date DESC LIMIT 1`,
    [assetId, onOrBefore ? toDateRepr(onOrBefore) : 99999999],
  );
  return row ? { price: row.price, date: fromDateRepr(row.date) } : null;
}

export async function getPriceHistory(
  assetId: InvestmentAssetEntity['id'],
  since: string,
): Promise<{ date: string; price: number }[]> {
  const rows = await db.all<DbQuote>(
    `SELECT price, date FROM investment_prices
     WHERE asset_id = ? AND date >= ? ORDER BY date ASC`,
    [assetId, toDateRepr(since)],
  );
  return rows.map(row => ({ date: fromDateRepr(row.date), price: row.price }));
}

export type FxRateInput = {
  base: string;
  quote: string;
  date: string;
  rate: number;
};

export async function setFxRates(rates: FxRateInput[]) {
  db.transaction(() => {
    for (const { base, quote, date, rate } of rates) {
      if (!(rate > 0)) {
        throw new ValidationError('rate must be greater than zero');
      }
      const pair = [base.toUpperCase(), quote.toUpperCase()];
      const dateRepr = toDateRepr(date);
      db.runQuery(
        `INSERT OR REPLACE INTO investment_fx_rates (id, base, quote, date, rate) VALUES (?, ?, ?, ?, ?)`,
        [`${pair.join('')}:${dateRepr}`, ...pair, dateRepr, rate],
      );
    }
  });
}

// Most recent rate on or before the date.
export async function getFxRate(
  from: string,
  to: string,
  onOrBefore?: string,
): Promise<number | null> {
  if (from === to) {
    return 1;
  }

  const date = onOrBefore ? toDateRepr(onOrBefore) : 99999999;
  const rows = await db.all<{ base: string; rate: number }>(
    `SELECT base, rate FROM investment_fx_rates
     WHERE ((base = ? AND quote = ?) OR (base = ? AND quote = ?)) AND date <= ?
     ORDER BY date DESC, base = ? DESC LIMIT 1`,
    [from, to, to, from, date, from],
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0].base === from ? rows[0].rate : 1 / rows[0].rate;
}
