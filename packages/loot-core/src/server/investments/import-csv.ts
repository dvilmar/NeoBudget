import { parse as csvParse } from 'csv-parse/sync';

import type { InvestmentAssetType, InvestmentTradeType } from '#types/models';

import type { BrokerTrade } from './brokers';

const ALIASES: Record<string, string[]> = {
  date: ['date', 'fecha', 'datum', 'trade date', 'time', 'timestamp'],
  type: [
    'type',
    'tipo',
    'side',
    'action',
    'operacion',
    'operación',
    'transaction type',
  ],
  symbol: ['symbol', 'ticker', 'simbolo', 'símbolo', 'asset', 'activo'],
  name: ['name', 'nombre', 'description', 'descripcion', 'descripción'],
  isin: ['isin'],
  quantity: [
    'quantity',
    'qty',
    'shares',
    'cantidad',
    'unidades',
    'amount of shares',
  ],
  price: [
    'price',
    'precio',
    'price per share',
    'unit price',
    'precio unitario',
  ],
  fee: ['fee', 'fees', 'comision', 'comisión', 'comisiones', 'commission'],
  currency: ['currency', 'divisa', 'moneda'],
  assetType: ['asset type', 'asset class', 'tipo de activo'],
};

const TRADE_TYPES: Record<string, InvestmentTradeType> = {
  buy: 'buy',
  bought: 'buy',
  compra: 'buy',
  purchase: 'buy',
  sell: 'sell',
  sold: 'sell',
  venta: 'sell',
  dividend: 'dividend',
  dividends: 'dividend',
  dividendo: 'dividend',
  fee: 'fee',
  fees: 'fee',
  comision: 'fee',
  comisión: 'fee',
};

const ASSET_TYPES: Record<string, InvestmentAssetType> = {
  stock: 'stock',
  accion: 'stock',
  acción: 'stock',
  etf: 'etf',
  fund: 'fund',
  fondo: 'fund',
  bond: 'bond',
  bono: 'bond',
  crypto: 'crypto',
  cripto: 'crypto',
};

export type CsvImport = {
  trades: BrokerTrade[];
  rejected: { line: number; reason: string }[];
};

// Accepts "1.234,56" and "1,234.56".
export function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(/[^\d.,-]/g, '');
  if (text === '' || text === '-') {
    return null;
  }

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let normalized = text;
  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (lastComma > -1) {
    // A single comma followed by three digits is a thousands separator
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(text)
      ? text.replace(/,/g, '')
      : text.replace(',', '.');
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseDate(raw: string): string | null {
  const text = raw.trim().split(/[T ]/)[0];

  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return text;
  }
  match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return null;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map(
    delimiter => [delimiter, firstLine.split(delimiter).length] as const,
  );
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseTradesCsv(
  text: string,
  defaultCurrency: string,
): CsvImport {
  const content = text.replace(/^﻿/, '');
  const rows = csvParse(content, {
    columns: header => header.map(name => String(name).trim().toLowerCase()),
    delimiter: detectDelimiter(content),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const result: CsvImport = { trades: [], rejected: [] };
  if (rows.length === 0) {
    return result;
  }

  const headers = Object.keys(rows[0]);
  const column: Record<string, string | undefined> = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    column[field] = headers.find(header => names.includes(header));
  }
  for (const required of ['date', 'type', 'quantity', 'price']) {
    if (!column[required]) {
      result.rejected.push({
        line: 1,
        reason: `The file has no "${required}" column`,
      });
    }
  }
  if (!column.symbol && !column.isin) {
    result.rejected.push({
      line: 1,
      reason: 'The file needs a "symbol" or an "isin" column',
    });
  }
  if (result.rejected.length > 0) {
    return result;
  }

  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const line = index + 2;
    const get = (field: string) => (column[field] ? row[column[field]!] : '');

    const date = parseDate(get('date') ?? '');
    const type = TRADE_TYPES[(get('type') ?? '').trim().toLowerCase()];
    const quantity = parseNumber(get('quantity') ?? '');
    const price = parseNumber(get('price') ?? '');
    const isin = (get('isin') ?? '').trim() || null;
    const symbol = (get('symbol') ?? '').trim() || isin;

    if (!date) {
      result.rejected.push({ line, reason: 'Unrecognised date' });
    } else if (!type) {
      result.rejected.push({ line, reason: 'Unknown type of operation' });
    } else if (!symbol) {
      result.rejected.push({ line, reason: 'No symbol or ISIN' });
    } else if (quantity == null || price == null) {
      result.rejected.push({
        line,
        reason: 'Quantity or price is not a number',
      });
    } else {
      const sign = (n: number) => Math.abs(n);
      const fee = parseNumber(get('fee') ?? '');
      const key = [date, type, symbol, sign(quantity), sign(price)].join('|');
      // Two identical rows in one file are two trades; the same file
      // imported again must still match them one by one
      const occurrence = (seen.get(key) ?? 0) + 1;
      seen.set(key, occurrence);

      result.trades.push({
        importedId: `csv:${key}|${occurrence}`,
        date,
        type,
        symbol,
        name: (get('name') ?? '').trim() || symbol,
        isin,
        assetType:
          ASSET_TYPES[(get('assetType') ?? '').trim().toLowerCase()] ?? 'other',
        currency: (
          (get('currency') ?? '').trim() || defaultCurrency
        ).toUpperCase(),
        quantity: sign(quantity),
        price: sign(price),
        fee: fee == null ? 0 : sign(fee),
        fxRate: null,
        priceSource: null,
        priceSourceId: null,
      });
    }
  });

  return result;
}
