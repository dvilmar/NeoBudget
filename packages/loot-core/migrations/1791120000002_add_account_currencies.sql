BEGIN TRANSACTION;

CREATE TABLE account_currencies
  (id TEXT PRIMARY KEY,
   account_id TEXT,
   currency TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX account_currencies_account ON account_currencies(account_id);

COMMIT;
