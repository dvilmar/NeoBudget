BEGIN TRANSACTION;

CREATE TABLE subscriptions
  (id TEXT PRIMARY KEY,
   schedule_id TEXT,
   tombstone INTEGER DEFAULT 0);

CREATE INDEX subscriptions_schedule ON subscriptions(schedule_id);

COMMIT;
