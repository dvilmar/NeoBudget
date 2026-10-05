import type { AccountEntity } from './account';

export type DebtKind = 'loan' | 'debt' | 'mortgage';

// Whether the user owes the money or is owed it
export type DebtDirection = 'owed_by_me' | 'owed_to_me';

export type DebtEntity = {
  id: string;
  name: string;
  kind: DebtKind;
  direction: DebtDirection;
  // Integer amount in the smallest unit of the budget currency
  principal: number;
  // Yearly interest in percent
  interest_rate: number;
  // YYYY-MM-DD
  start_date: string | null;
  monthly_payment: number | null;
  account_id: AccountEntity['id'] | null;
  notes: string | null;
};

export type DebtPaymentEntity = {
  id: string;
  debt_id: DebtEntity['id'];
  // YYYY-MM-DD
  date: string;
  // Everything paid, interest included
  amount: number;
  // The part of the payment that is interest
  interest: number;
  notes: string | null;
  // The transaction that moved the money in an account, if any
  transaction_id: string | null;
};

export type DebtProgress = DebtEntity & {
  paid: number;
  interestPaid: number;
  // What is still owed
  outstanding: number;
  // 0 to 100 of the principal already paid off
  percent: number;
  // Interest expected in the next month at the current balance
  nextInterest: number;
  // Months left at the monthly payment, or null when it is unknown or
  // the payment does not even cover the interest
  monthsLeft: number | null;
};
