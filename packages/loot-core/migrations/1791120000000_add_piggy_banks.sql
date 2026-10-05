BEGIN TRANSACTION;

CREATE TABLE piggy_banks
  (id TEXT PRIMARY KEY,
   name TEXT,
   target_amount INTEGER DEFAULT 0,
   target_date INTEGER,
   account_id TEXT,
   notes TEXT,
   sort_order REAL,
   tombstone INTEGER DEFAULT 0);

CREATE TABLE piggy_bank_events
  (id TEXT PRIMARY KEY,
   piggy_bank_id TEXT,
   date INTEGER,
   amount INTEGER,
   notes TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX piggy_bank_events_piggy ON piggy_bank_events(piggy_bank_id);

COMMIT;
