BEGIN TRANSACTION;

-- Assets that are only followed, without trades, form the watchlist
ALTER TABLE investment_assets ADD COLUMN watched INTEGER DEFAULT 0;

COMMIT;
