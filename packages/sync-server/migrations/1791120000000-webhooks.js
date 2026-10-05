import { getAccountDb } from '../src/account-db';

export const up = async function () {
  const accountDb = getAccountDb();

  accountDb.exec(`
    CREATE TABLE IF NOT EXISTS webhooks
      (id TEXT NOT NULL PRIMARY KEY,
       url TEXT NOT NULL,
       active INTEGER DEFAULT 1,
       created_at TEXT);
  `);
};

export const down = async function () {
  const accountDb = getAccountDb();

  accountDb.exec(`
    DROP TABLE IF EXISTS webhooks;
  `);
};
