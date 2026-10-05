import type { BrokerStatement, BrokerTrade } from './types';

const FLEX_URL =
  'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService';
const REQUEST_TIMEOUT_MS = 30 * 1000;
const STATEMENT_ATTEMPTS = 10;
const STATEMENT_WAIT_MS = 3000;
// "Statement generation in progress. Please try again shortly."
const ERROR_IN_PROGRESS = '1019';

// Yahoo Finance suffix for the exchanges IBKR lists European assets on.
// US exchanges need no suffix.
const YAHOO_SUFFIX: Record<string, string> = {
  IBIS: '.DE',
  IBIS2: '.DE',
  FWB: '.F',
  FWB2: '.F',
  GETTEX: '.MU',
  GETTEX2: '.MU',
  AEB: '.AS',
  SBF: '.PA',
  BVME: '.MI',
  'BVME.ETF': '.MI',
  BM: '.MC',
  LSE: '.L',
  LSEETF: '.L',
  EBS: '.SW',
  VSE: '.VI',
  ENEXT_BE: '.BR',
  BVL: '.LS',
  SFB: '.ST',
};
const US_EXCHANGES = new Set([
  'NYSE',
  'NASDAQ',
  'ARCA',
  'AMEX',
  'BATS',
  'IEX',
  'PINK',
]);

const IMPORTED_CATEGORIES = new Set(['STK', 'FUND', 'BOND', 'CRYPTO']);

type Attributes = Record<string, string>;

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readElements(xml: string, tag: string): Attributes[] {
  const elements: Attributes[] = [];
  const pattern = new RegExp(`<${tag}\\s([^>]*?)/?>`, 'g');
  for (const element of xml.matchAll(pattern)) {
    const attributes: Attributes = {};
    for (const attribute of element[1].matchAll(/([\w.]+)="([^"]*)"/g)) {
      attributes[attribute[1]] = decodeEntities(attribute[2]);
    }
    elements.push(attributes);
  }
  return elements;
}

function readTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match ? decodeEntities(match[1].trim()) : null;
}

function toDate(value: string | undefined): string | null {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function toNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAssetType(row: Attributes): BrokerTrade['assetType'] {
  switch (row.assetCategory) {
    case 'STK':
      return row.subCategory === 'ETF' ? 'etf' : 'stock';
    case 'FUND':
      return 'fund';
    case 'BOND':
      return 'bond';
    case 'CRYPTO':
      return 'crypto';
    default:
      return 'other';
  }
}

function getPriceSource(
  row: Attributes,
): Pick<BrokerTrade, 'priceSource' | 'priceSourceId'> {
  const exchange = row.listingExchange ?? '';
  if (row.assetCategory === 'STK' && row.symbol) {
    if (exchange in YAHOO_SUFFIX) {
      return {
        priceSource: 'yahoo',
        priceSourceId: row.symbol + YAHOO_SUFFIX[exchange],
      };
    }
    if (US_EXCHANGES.has(exchange)) {
      // IBKR writes share classes as "BRK B", Yahoo as "BRK-B"
      return {
        priceSource: 'yahoo',
        priceSourceId: row.symbol.replace(' ', '-'),
      };
    }
  }
  return { priceSource: null, priceSourceId: null };
}

function describeAsset(row: Attributes) {
  return {
    symbol: row.symbol,
    name: row.description || row.symbol,
    isin: row.isin || null,
    assetType: getAssetType(row),
    currency: row.currency,
    fxRate: toNumber(row.fxRateToBase),
    ...getPriceSource(row),
  };
}

function count(skipped: Record<string, number>, kind: string) {
  skipped[kind] = (skipped[kind] ?? 0) + 1;
}

export function parseFlexStatement(xml: string): BrokerStatement {
  const trades: BrokerTrade[] = [];
  const skipped: Record<string, number> = {};

  for (const row of readElements(xml, 'Trade')) {
    // Orders and closed lots repeat what the executions already say
    if (row.levelOfDetail && row.levelOfDetail !== 'EXECUTION') {
      continue;
    }

    const date = toDate(row.tradeDate || row.dateTime);
    const quantity = toNumber(row.quantity);
    const price = toNumber(row.tradePrice);
    const id = row.tradeID || row.transactionID;
    if (
      !IMPORTED_CATEGORIES.has(row.assetCategory) ||
      !row.symbol ||
      !row.currency ||
      !id ||
      !date ||
      !quantity ||
      price == null
    ) {
      count(skipped, row.assetCategory || 'unknown');
      continue;
    }

    const commission = toNumber(row.ibCommission) ?? 0;
    // A commission charged in another currency cannot be added to the
    // cost in the trade currency
    const sameCurrency =
      !row.ibCommissionCurrency || row.ibCommissionCurrency === row.currency;
    if (!sameCurrency && commission !== 0) {
      count(skipped, 'commission in another currency');
    }

    trades.push({
      importedId: `ibkr:${id}`,
      date,
      type: quantity > 0 ? 'buy' : 'sell',
      ...describeAsset(row),
      quantity: Math.abs(quantity),
      price,
      fee: sameCurrency ? Math.abs(commission) : 0,
    });
  }

  for (const row of readElements(xml, 'CashTransaction')) {
    const isDividend =
      row.type === 'Dividends' || row.type === 'Payment In Lieu Of Dividends';
    const isTax = row.type === 'Withholding Tax';
    if (!isDividend && !isTax) {
      continue;
    }

    const date = toDate(row.reportDate || row.dateTime || row.settleDate);
    const amount = toNumber(row.amount);
    if (
      !row.symbol ||
      !row.currency ||
      !row.transactionID ||
      !date ||
      !amount
    ) {
      count(skipped, row.type);
      continue;
    }

    // Reversed dividends and refunded tax come with the opposite sign
    const isIncome = amount > 0;
    trades.push({
      importedId: `ibkr:${row.transactionID}`,
      date,
      type: isIncome ? 'dividend' : 'fee',
      ...describeAsset(row),
      quantity: isIncome ? 1 : 0,
      price: isIncome ? amount : 0,
      fee: isIncome ? 0 : Math.abs(amount),
    });
  }

  return { trades, skipped };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NeoBudget/1.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Interactive Brokers responded with ${res.status}`);
  }
  return res.text();
}

function readError(xml: string): { code: string | null; message: string } {
  return {
    code: readTag(xml, 'ErrorCode'),
    message:
      readTag(xml, 'ErrorMessage') ??
      'Unexpected answer from Interactive Brokers',
  };
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Two steps: request the statement, then collect it with the reference code.
export async function fetchFlexStatement(
  token: string,
  queryId: string,
  waitMs = STATEMENT_WAIT_MS,
): Promise<BrokerStatement> {
  const credentials = `t=${encodeURIComponent(token)}&v=3`;
  const request = await fetchText(
    `${FLEX_URL}/SendRequest?${credentials}&q=${encodeURIComponent(queryId)}`,
  );
  const reference = readTag(request, 'ReferenceCode');
  if (readTag(request, 'Status') !== 'Success' || !reference) {
    throw new Error(readError(request).message);
  }

  for (let attempt = 0; attempt < STATEMENT_ATTEMPTS; attempt++) {
    const statement = await fetchText(
      `${FLEX_URL}/GetStatement?${credentials}&q=${encodeURIComponent(reference)}`,
    );
    if (statement.includes('<FlexQueryResponse')) {
      return parseFlexStatement(statement);
    }

    const error = readError(statement);
    if (error.code !== ERROR_IN_PROGRESS) {
      throw new Error(error.message);
    }
    await wait(waitMs);
  }

  throw new Error(
    'Interactive Brokers is taking too long to build the statement',
  );
}
