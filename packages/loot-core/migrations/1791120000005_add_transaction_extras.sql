BEGIN TRANSACTION;

CREATE TABLE transaction_fx
  (id TEXT PRIMARY KEY,
   transaction_id TEXT,
   currency TEXT,
   amount INTEGER,
   rate REAL,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX transaction_fx_transaction ON transaction_fx(transaction_id);

CREATE TABLE transaction_links
  (id TEXT PRIMARY KEY,
   transaction_a TEXT,
   transaction_b TEXT,
   link_type TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX transaction_links_a ON transaction_links(transaction_a);
CREATE INDEX transaction_links_b ON transaction_links(transaction_b);

CREATE TABLE transaction_attachments
  (id TEXT PRIMARY KEY,
   transaction_id TEXT,
   name TEXT,
   mime TEXT,
   size INTEGER,
   remote_id TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX transaction_attachments_transaction ON transaction_attachments(transaction_id);

CREATE TABLE audit_log
  (id TEXT PRIMARY KEY,
   at TEXT,
   entity TEXT,
   action TEXT,
   summary TEXT,
   tombstone INTEGER DEFAULT 0);

ALTER TABLE piggy_banks ADD COLUMN group_name TEXT;
ALTER TABLE subscriptions ADD COLUMN group_name TEXT;

COMMIT;
