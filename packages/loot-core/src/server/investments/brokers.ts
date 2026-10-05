import * as asyncStorage from '#platform/server/asyncStorage';
import { post } from '#server/post';
import { getServer } from '#server/server-config';
import { batchMessages } from '#server/sync';
import type {
  InvestmentAssetEntity,
  InvestmentAssetType,
  InvestmentTradeEntity,
  InvestmentTradeType,
} from '#types/models';

import * as investmentsDb from './db';
import { errorMessage } from './prices';

export type Broker = 'ibkr';

export type BrokerTrade = {
  importedId: string;
  date: string;
  type: InvestmentTradeType;
  symbol: string;
  name: string;
  isin: string | null;
  assetType: InvestmentAssetType;
  currency: string;
  quantity: number;
  price: number;
  fee: number;
  fxRate: number | null;
  priceSource: string | null;
  priceSourceId: string | null;
};

type BrokerStatement = {
  trades: BrokerTrade[];
  skipped: Record<string, number>;
};

export type BrokerSyncResult = {
  imported: number;
  duplicates: number;
  assetsCreated: number;
  skipped: Record<string, number>;
  error: string | null;
};

export type BrokersStatus = Record<Broker, { configured: boolean }>;

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

async function getConnection() {
  const userToken = await asyncStorage.getItem('user-token');
  const server = getServer();
  if (!userToken || !server) {
    return null;
  }
  return {
    url: server.BASE_SERVER.replace(/\/+$/, '') + '/brokers',
    headers: { 'X-ACTUAL-TOKEN': userToken },
  };
}

export async function getBrokersStatus(): Promise<BrokersStatus | null> {
  const connection = await getConnection();
  if (!connection) {
    return null;
  }
  try {
    return await post(connection.url + '/status', {}, connection.headers);
  } catch {
    return null;
  }
}

export async function importTrades(
  trades: BrokerTrade[],
  accountId: InvestmentTradeEntity['account_id'],
  result: Pick<BrokerSyncResult, 'imported' | 'duplicates' | 'assetsCreated'>,
) {
  const assets = await investmentsDb.getAssets();
  await batchMessages(async () => {
    for (const trade of trades) {
      if (await investmentsDb.findImportedTrade(trade.importedId, accountId)) {
        result.duplicates++;
        continue;
      }

      let asset = findAsset(assets, trade);
      if (!asset) {
        const fields = {
          symbol: trade.symbol,
          name: trade.name,
          type: trade.assetType,
          currency: trade.currency,
          isin: trade.isin,
          price_source: trade.priceSource,
          price_source_id: trade.priceSourceId,
        };
        asset = { id: await investmentsDb.insertAsset(fields), ...fields };
        assets.push(asset);
        result.assetsCreated++;
      }

      await investmentsDb.insertTrade({
        asset_id: asset.id,
        account_id: accountId,
        date: trade.date,
        type: trade.type,
        quantity: trade.quantity,
        price: trade.price,
        fee: trade.fee,
        fx_rate: trade.fxRate,
        imported_id: trade.importedId,
      });
      result.imported++;
    }
  });
}

// ISIN identifies an asset across exchanges; a symbol is only unique with its currency.
function findAsset(assets: InvestmentAssetEntity[], trade: BrokerTrade) {
  return assets.find(asset =>
    trade.isin && asset.isin
      ? asset.isin === trade.isin && asset.currency === trade.currency
      : asset.symbol === trade.symbol && asset.currency === trade.currency,
  );
}

export async function syncBroker({
  broker,
  accountId = null,
}: {
  broker: Broker;
  accountId?: InvestmentTradeEntity['account_id'];
}): Promise<BrokerSyncResult> {
  const result: BrokerSyncResult = {
    imported: 0,
    duplicates: 0,
    assetsCreated: 0,
    skipped: {},
    error: null,
  };

  const connection = await getConnection();
  if (!connection) {
    return { ...result, error: 'A sync server is needed to connect a broker' };
  }

  let statement: BrokerStatement;
  try {
    statement = await post(
      `${connection.url}/${broker}/trades`,
      {},
      connection.headers,
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    return { ...result, error: errorMessage(error) };
  }
  result.skipped = statement.skipped;

  await importTrades(statement.trades, accountId, result);

  return result;
}

// The PIN only passes through to the sync server: never stored, logged or synced; errors are fixed codes.
export type TradeRepublicErrorCode =
  | 'no-server'
  | 'invalid-input'
  | 'login-failed'
  | 'invalid-code'
  | 'login-expired'
  | 'too-many-attempts'
  | 'unavailable';

const TRADE_REPUBLIC_ERRORS: readonly TradeRepublicErrorCode[] = [
  'invalid-input',
  'login-failed',
  'invalid-code',
  'login-expired',
  'too-many-attempts',
  'unavailable',
];

const TRADE_REPUBLIC_TIMEOUT_MS = 5 * 60 * 1000;

function tradeRepublicErrorCode(error: unknown): TradeRepublicErrorCode {
  const reason: unknown =
    typeof error === 'object' && error !== null && 'reason' in error
      ? error.reason
      : null;
  return TRADE_REPUBLIC_ERRORS.find(code => code === reason) ?? 'unavailable';
}

export async function tradeRepublicLogin({
  phone,
  pin,
}: {
  phone: string;
  pin: string;
}): Promise<
  | { processId: string; secondsToCode: number; error: null }
  | { error: TradeRepublicErrorCode }
> {
  const connection = await getConnection();
  if (!connection) {
    return { error: 'no-server' };
  }
  try {
    const data: { processId: string; secondsToCode: number } = await post(
      `${connection.url}/traderepublic/login`,
      { phone, pin },
      connection.headers,
      REQUEST_TIMEOUT_MS,
    );
    return {
      processId: data.processId,
      secondsToCode: data.secondsToCode,
      error: null,
    };
  } catch (error) {
    return { error: tradeRepublicErrorCode(error) };
  }
}

export async function tradeRepublicImport({
  processId,
  code,
  accountId = null,
}: {
  processId: string;
  code: string;
  accountId?: InvestmentTradeEntity['account_id'];
}): Promise<
  Omit<BrokerSyncResult, 'error'> & { error: TradeRepublicErrorCode | null }
> {
  const result = {
    imported: 0,
    duplicates: 0,
    assetsCreated: 0,
    skipped: {},
    error: null,
  };

  const connection = await getConnection();
  if (!connection) {
    return { ...result, error: 'no-server' };
  }

  let statement: BrokerStatement;
  try {
    statement = await post(
      `${connection.url}/traderepublic/verify`,
      { processId, code },
      connection.headers,
      TRADE_REPUBLIC_TIMEOUT_MS,
    );
  } catch (error) {
    return { ...result, error: tradeRepublicErrorCode(error) };
  }

  const counts = { ...result, skipped: statement.skipped };
  await importTrades(statement.trades, accountId, counts);
  return counts;
}
