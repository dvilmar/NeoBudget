export type BrokerTrade = {
  // Unique within the broker, used to skip trades already imported
  importedId: string;
  // YYYY-MM-DD
  date: string;
  type: 'buy' | 'sell' | 'dividend' | 'fee';
  symbol: string;
  name: string;
  isin: string | null;
  assetType: 'stock' | 'etf' | 'fund' | 'bond' | 'crypto' | 'other';
  currency: string;
  quantity: number;
  price: number;
  fee: number;
  // Trade currency to the base currency of the broker account
  fxRate: number | null;
  // Best guess of where to get prices, when the broker gives enough
  priceSource: 'yahoo' | 'coingecko' | null;
  priceSourceId: string | null;
};

export type BrokerStatement = {
  trades: BrokerTrade[];
  // Rows the connector does not know how to import, by kind
  skipped: Record<string, number>;
};
