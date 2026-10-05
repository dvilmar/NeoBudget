import { createApp } from '#server/app';
import * as db from '#server/db';
import { ValidationError } from '#server/errors';
import { logAudit } from '#server/extras/audit';
import { getFxRate } from '#server/investments/db';
import { mutator } from '#server/mutators';
import { undoable } from '#server/undo';

type DbAccountCurrency = {
  id: string;
  account_id: string;
  currency: string;
};

export type CurrenciesHandlers = {
  'account-currencies-get': typeof getAccountCurrencies;
  'account-currency-set': typeof setAccountCurrency;
  'fx-rates-get': typeof getRates;
};

export const app = createApp<CurrenciesHandlers>();
app.method('account-currencies-get', getAccountCurrencies);
app.method('account-currency-set', mutator(undoable(setAccountCurrency)));
app.method('fx-rates-get', getRates);

// Accounts without an entry use the budget currency.
async function getAccountCurrencies(): Promise<Record<string, string>> {
  const rows = await db.all<DbAccountCurrency>(
    `SELECT id, account_id, currency FROM account_currencies WHERE tombstone = 0`,
  );
  return Object.fromEntries(rows.map(row => [row.account_id, row.currency]));
}

async function setAccountCurrency({
  accountId,
  currency,
}: {
  accountId: string;
  currency: string | null;
}): Promise<void> {
  const code = currency?.trim().toUpperCase() ?? null;
  if (code != null && !/^[A-Z]{3,5}$/.test(code)) {
    throw new ValidationError('A currency code is 3 to 5 letters, like USD');
  }

  await logAudit(
    'account',
    'update',
    `Account currency set to ${code ?? 'the budget currency'}`,
  );

  const existing = await db.first<Pick<DbAccountCurrency, 'id'>>(
    `SELECT id FROM account_currencies WHERE account_id = ? AND tombstone = 0`,
    [accountId],
  );

  if (code == null) {
    if (existing) {
      await db.delete_('account_currencies', existing.id);
    }
  } else if (existing) {
    await db.update('account_currencies', { id: existing.id, currency: code });
  } else {
    await db.insertWithUUID('account_currencies', {
      account_id: accountId,
      currency: code,
    });
  }
}

// Null when no exchange rate is known yet.
async function getRates({
  base,
  currencies,
}: {
  base: string;
  currencies: string[];
}): Promise<Record<string, number | null>> {
  const target = base.toUpperCase();
  const result: Record<string, number | null> = {};
  for (const currency of new Set(currencies.map(code => code.toUpperCase()))) {
    result[currency] = await getFxRate(currency, target);
  }
  return result;
}
