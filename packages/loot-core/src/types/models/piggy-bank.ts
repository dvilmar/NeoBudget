import type { AccountEntity } from './account';

export type PiggyBankEntity = {
  id: string;
  name: string;
  // Integer amount in the smallest unit of the budget currency
  target_amount: number;
  // YYYY-MM-DD
  target_date: string | null;
  // Account where the saved money is kept, if any
  account_id: AccountEntity['id'] | null;
  notes: string | null;
  sort_order: number;
  // Piggy banks with the same group name are shown together
  group_name: string | null;
};

export type PiggyBankEventEntity = {
  id: string;
  piggy_bank_id: PiggyBankEntity['id'];
  // YYYY-MM-DD
  date: string;
  // Positive when money is put in, negative when it is taken out
  amount: number;
  notes: string | null;
  // The transaction that moved the money in an account, if any
  transaction_id: string | null;
};

export type PiggyBankProgress = PiggyBankEntity & {
  saved: number;
  // 0 to 100, or null when there is no target
  percent: number | null;
  // What is still needed per month until the target date, when both a
  // target date in the future and a missing amount exist
  monthlyNeeded: number | null;
};
