import * as db from '#server/db';

// `amount` is what the account gains (positive) or loses (negative).
export async function createLinkedTransaction({
  accountId,
  categoryId,
  date,
  amount,
  notes,
}: {
  accountId: string;
  categoryId?: string | null;
  date: string;
  amount: number;
  notes: string;
}): Promise<string> {
  return db.insertTransaction({
    account: accountId,
    category: categoryId ?? null,
    date,
    amount,
    notes,
    cleared: false,
  });
}

export async function deleteLinkedTransaction(id: string | null | undefined) {
  if (id) {
    await db.deleteTransaction({ id });
  }
}
