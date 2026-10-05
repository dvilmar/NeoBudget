import type { AccountEntity } from './account';

export type InvestmentAssetType =
  | 'stock'
  | 'etf'
  | 'fund'
  | 'bond'
  | 'crypto'
  | 'other';

export type InvestmentAssetEntity = {
  id: string;
  symbol: string;
  name: string;
  type: InvestmentAssetType;
  // ISO code of the currency the asset is quoted and traded in
  currency: string;
  isin: string | null;
  // Where automatic prices come from, and the id the source knows it by
  price_source: string | null;
  price_source_id: string | null;
  // 1 when the asset is on the watchlist
  watched?: number | null;
};

export type InvestmentTradeType = 'buy' | 'sell' | 'dividend' | 'fee';

export type InvestmentTradeEntity = {
  id: string;
  asset_id: InvestmentAssetEntity['id'];
  account_id: AccountEntity['id'] | null;
  // YYYY-MM-DD
  date: string;
  type: InvestmentTradeType;
  // Units bought, sold or paying a dividend
  quantity: number;
  // Price per unit in the asset currency
  price: number;
  // Total fee in the asset currency
  fee: number;
  // Asset currency to base currency rate at the time of the trade
  fx_rate: number | null;
  notes: string | null;
  // Id given by the broker, used to avoid importing a trade twice
  imported_id: string | null;
};

export type InvestmentPosition = {
  quantity: number;
  // What the units still held cost, fees included
  costBasis: number;
  averageCost: number;
  realizedGain: number;
  income: number;
  fees: number;
};

export type InvestmentValuation = {
  price: number | null;
  priceDate: string | null;
  marketValue: number | null;
  unrealizedGain: number | null;
  unrealizedGainPercent: number | null;
};

export type InvestmentPositionEntity = InvestmentPosition &
  InvestmentValuation & {
    asset: InvestmentAssetEntity;
    // Accounts the trades of this asset were made in
    accountIds: string[];
    // The same figures in the base currency. Null when no base currency
    // was requested or an exchange rate is missing
    base: {
      currency: string;
      costBasis: number;
      realizedGain: number;
      income: number;
      marketValue: number | null;
      unrealizedGain: number | null;
    } | null;
  };
