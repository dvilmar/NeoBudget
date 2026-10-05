BEGIN TRANSACTION;

CREATE TABLE debts
  (id TEXT PRIMARY KEY,
   name TEXT,
   kind TEXT,
   direction TEXT,
   principal INTEGER DEFAULT 0,
   interest_rate REAL DEFAULT 0,
   start_date INTEGER,
   monthly_payment INTEGER,
   account_id TEXT,
   notes TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE TABLE debt_payments
  (id TEXT PRIMARY KEY,
   debt_id TEXT,
   date INTEGER,
   amount INTEGER,
   interest INTEGER DEFAULT 0,
   notes TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX debt_payments_debt ON debt_payments(debt_id);

COMMIT;
