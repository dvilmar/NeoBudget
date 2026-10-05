BEGIN TRANSACTION;

ALTER TABLE piggy_bank_events ADD COLUMN transaction_id TEXT;
ALTER TABLE debt_payments ADD COLUMN transaction_id TEXT;

COMMIT;
