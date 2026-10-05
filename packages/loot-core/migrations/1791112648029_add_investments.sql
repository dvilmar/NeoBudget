BEGIN TRANSACTION;

CREATE TABLE investment_assets
  (id TEXT PRIMARY KEY,
   symbol TEXT,
   name TEXT,
   type TEXT,
   currency TEXT,
   isin TEXT,
   price_source TEXT,
   price_source_id TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE TABLE investment_trades
  (id TEXT PRIMARY KEY,
   asset_id TEXT,
   account_id TEXT,
   date INTEGER,
   type TEXT,
   quantity REAL,
   price REAL,
   fee REAL DEFAULT 0,
   fx_rate REAL,
   notes TEXT,
   imported_id TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX investment_trades_asset_date ON investment_trades(asset_id, date);

-- Prices and exchange rates are a local cache that every device can
-- fetch again, so they are not synced
CREATE TABLE investment_prices
  (id TEXT PRIMARY KEY,
   asset_id TEXT,
   date INTEGER,
   price REAL,
   source TEXT);

CREATE INDEX investment_prices_asset_date ON investment_prices(asset_id, date);

CREATE TABLE investment_fx_rates
  (id TEXT PRIMARY KEY,
   base TEXT,
   quote TEXT,
   date INTEGER,
   rate REAL);

CREATE INDEX investment_fx_rates_pair_date ON investment_fx_rates(base, quote, date);

COMMIT;
