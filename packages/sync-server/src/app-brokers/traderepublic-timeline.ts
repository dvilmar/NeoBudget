// Turns the Trade Republic timeline into broker trades.
//
// UNVERIFIED: the event types, field names and row titles below are the
// best available understanding of what the web app receives with the
// "en" locale, not something checked against a real account. Unknown
// events are left out, and timeline items of a known kind that cannot
// be read are counted in `skipped` so a mismatch shows up on import.

import type { TimelineEntry } from './traderepublic-client';
import type { BrokerStatement, BrokerTrade } from './types';

const TRADE_EVENTS = new Set([
  'TRADE_INVOICE',
  'ORDER_EXECUTED',
  'SAVINGS_PLAN_EXECUTED',
  'SAVINGS_PLAN_INVOICE_CREATED',
  'trading_trade_executed',
  'trading_savingsplan_executed',
  'benefits_saveback_execution',
  'benefits_spare_change_execution',
]);
const DIVIDEND_EVENTS = new Set([
  'CREDIT',
  'ssp_corporate_action_invoice_cash',
]);
const INTEREST_EVENTS = new Set(['INTEREST_PAYOUT', 'INTEREST_PAYOUT_CREATED']);
const DONE_STATUSES = new Set(['EXECUTED', 'SETTLED', 'COMPLETED']);

// English first, German as fallback in case the locale is not honoured.
const ROW_TITLES = {
  shares: ['shares', 'quantity', 'anteile', 'aktien', 'stück'],
  price: ['share price', 'price', 'aktienkurs', 'kurs', 'preis'],
  fee: ['fee', 'external cost surcharge', 'gebühr', 'fremdkostenzuschlag'],
  tax: [
    'tax',
    'taxes',
    'withholding tax',
    'steuer',
    'steuern',
    'quellensteuer',
    'kapitalertragsteuer',
  ],
  transaction: ['transaction', 'transaktion'],
};

const ISIN_PATTERN = /[A-Z]{2}[A-Z0-9]{9}\d/;

// Interest is paid on cash, so it goes to its own renamable asset.
const INTEREST_ASSET = {
  symbol: 'TR-INTEREST',
  name: 'Trade Republic interest',
  isin: null,
  assetType: 'other',
  priceSource: null,
  priceSourceId: null,
} as const;

type Row = { title: string; text: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type EventKind = 'trade' | 'dividend' | 'interest' | null;

export function getEventKind(item: Record<string, unknown>): EventKind {
  const type = typeof item.eventType === 'string' ? item.eventType : '';
  if (TRADE_EVENTS.has(type)) {
    return 'trade';
  }
  if (DIVIDEND_EVENTS.has(type)) {
    return 'dividend';
  }
  if (INTEREST_EVENTS.has(type)) {
    return 'interest';
  }
  return null;
}

export function needsDetail(item: Record<string, unknown>): boolean {
  const kind = getEventKind(item);
  return kind === 'trade' || kind === 'dividend';
}

// Display-formatted amounts ("€1,234.56", "1.5", "Free"): the last separator is the decimal point.
export function parseDisplayNumber(text: string): number | null {
  if (/free|kostenlos|gratis/i.test(text)) {
    return 0;
  }
  let digits = text.replace(/[^\d.,-]/g, '');
  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    digits =
      lastComma > lastDot
        ? digits.replace(/\./g, '').replace(',', '.')
        : digits.replace(/,/g, '');
  } else if (lastComma > -1) {
    digits = /^-?\d{1,3}(,\d{3})+$/.test(digits)
      ? digits.replace(/,/g, '')
      : digits.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(digits)) {
    return null;
  }
  return Number(digits);
}

function readRows(detail: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  const sections =
    detail && Array.isArray(detail.sections) ? detail.sections : [];
  for (const section of sections) {
    if (!isRecord(section) || !Array.isArray(section.data)) {
      continue;
    }
    for (const row of section.data) {
      if (!isRecord(row) || typeof row.title !== 'string') {
        continue;
      }
      const detailText = isRecord(row.detail) ? row.detail.text : null;
      if (typeof detailText === 'string') {
        rows.push({ title: row.title.trim().toLowerCase(), text: detailText });
      }
    }
  }
  return rows;
}

function findNumber(rows: Row[], titles: string[]): number | null {
  for (const title of titles) {
    const row = rows.find(row => row.title === title);
    const value = row ? parseDisplayNumber(row.text) : null;
    if (value != null) {
      return value;
    }
  }
  return null;
}

// "3 × €100.00" in a single transaction row
function findSharesTimesPrice(rows: Row[]) {
  const row = rows.find(row => ROW_TITLES.transaction.includes(row.title));
  const parts = row?.text.split(/\s*[×x]\s*/);
  if (!parts || parts.length !== 2) {
    return null;
  }
  const shares = parseDisplayNumber(parts[0]);
  const price = parseDisplayNumber(parts[1]);
  return shares != null && price != null ? { shares, price } : null;
}

function findIsin(value: unknown, depth = 0): string | null {
  if (depth > 6) {
    return null;
  }
  if (typeof value === 'string') {
    return ISIN_PATTERN.exec(value)?.[0] ?? null;
  }
  if (Array.isArray(value)) {
    for (const element of value) {
      const isin = findIsin(element, depth + 1);
      if (isin) {
        return isin;
      }
    }
    return null;
  }
  if (isRecord(value)) {
    // Only where an instrument is referenced, not in free text
    for (const key of ['icon', 'payload', 'isin', 'instrumentId', 'action']) {
      const isin = findIsin(value[key], depth + 1);
      if (isin) {
        return isin;
      }
    }
    for (const key of ['sections', 'data']) {
      const isin = findIsin(value[key], depth + 1);
      if (isin) {
        return isin;
      }
    }
  }
  return null;
}

function toDate(value: unknown): string | null {
  const match =
    typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null;
  return match ? match[1] : null;
}

function count(skipped: Record<string, number>, kind: string) {
  skipped[kind] = (skipped[kind] ?? 0) + 1;
}

function round(value: number) {
  return Math.round(value * 1e8) / 1e8;
}

export function parseTimeline(entries: TimelineEntry[]): BrokerStatement {
  const trades: BrokerTrade[] = [];
  const skipped: Record<string, number> = {};

  for (const { item, detail } of entries) {
    const kind = getEventKind(item);
    if (!kind) {
      continue;
    }
    if (typeof item.status === 'string' && !DONE_STATUSES.has(item.status)) {
      count(skipped, 'not executed');
      continue;
    }

    const id = typeof item.id === 'string' ? item.id : null;
    const date = toDate(item.timestamp);
    const amount = isRecord(item.amount) ? Number(item.amount.value) : NaN;
    const currency =
      isRecord(item.amount) &&
      typeof item.amount.currency === 'string' &&
      /^[A-Z]{3}$/.test(item.amount.currency)
        ? item.amount.currency
        : 'EUR';
    if (!id || !date || !Number.isFinite(amount) || amount === 0) {
      count(skipped, `unreadable ${kind}`);
      continue;
    }
    const base = { date, currency, fxRate: null };

    if (kind === 'interest') {
      trades.push({
        ...base,
        ...INTEREST_ASSET,
        importedId: `tr:${id}`,
        type: amount > 0 ? 'dividend' : 'fee',
        quantity: amount > 0 ? 1 : 0,
        price: amount > 0 ? amount : 0,
        fee: amount > 0 ? 0 : Math.abs(amount),
      });
      continue;
    }

    const isin = findIsin(item) ?? findIsin(detail);
    if (!isin) {
      count(skipped, `${kind} without ISIN`);
      continue;
    }
    const isCrypto = isin.startsWith('XF000');
    const asset = {
      symbol: isin,
      name:
        typeof item.title === 'string' && item.title.trim()
          ? item.title.trim()
          : isin,
      isin,
      assetType: isCrypto ? 'crypto' : 'stock',
      priceSource: isCrypto ? null : 'yahoo',
      priceSourceId: null,
    } as const;

    const rows = readRows(detail);
    const fee = Math.abs(findNumber(rows, ROW_TITLES.fee) ?? 0);
    const tax = Math.abs(findNumber(rows, ROW_TITLES.tax) ?? 0);
    const taxTrade: BrokerTrade | null =
      tax > 0
        ? {
            ...base,
            ...asset,
            importedId: `tr:${id}:tax`,
            type: 'fee',
            quantity: 0,
            price: 0,
            fee: tax,
          }
        : null;

    if (kind === 'dividend') {
      // The timeline shows what was paid out, after tax
      trades.push({
        ...base,
        ...asset,
        importedId: `tr:${id}`,
        type: 'dividend',
        quantity: 1,
        price: round(Math.abs(amount) + tax),
        fee: 0,
      });
      if (taxTrade) {
        trades.push(taxTrade);
      }
      continue;
    }

    // Money going out is a buy, money coming in a sale
    const isBuy = amount < 0;
    const combined = findSharesTimesPrice(rows);
    const shares = Math.abs(
      findNumber(rows, ROW_TITLES.shares) ?? combined?.shares ?? 0,
    );
    if (shares === 0) {
      count(skipped, 'trade without shares');
      continue;
    }
    const total = Math.abs(amount);
    const price =
      findNumber(rows, ROW_TITLES.price) ??
      combined?.price ??
      round((isBuy ? total - fee : total + fee + tax) / shares);

    trades.push({
      ...base,
      ...asset,
      importedId: `tr:${id}`,
      type: isBuy ? 'buy' : 'sell',
      quantity: shares,
      price: Math.abs(price),
      fee,
    });
    if (taxTrade) {
      trades.push(taxTrade);
    }
  }

  return { trades, skipped };
}
