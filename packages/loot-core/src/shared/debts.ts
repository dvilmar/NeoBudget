import type {
  DebtEntity,
  DebtPaymentEntity,
  DebtProgress,
} from '#types/models';

export function monthlyInterest(outstanding: number, yearlyRate: number) {
  return Math.round((outstanding * yearlyRate) / 100 / 12);
}

export function monthsToPayOff(
  outstanding: number,
  yearlyRate: number,
  payment: number,
): number | null {
  if (outstanding <= 0) {
    return 0;
  }
  if (payment <= 0) {
    return null;
  }

  const rate = yearlyRate / 100 / 12;
  if (rate === 0) {
    return Math.ceil(outstanding / payment);
  }
  // The payment has to beat the interest or the debt never shrinks
  if (payment <= outstanding * rate) {
    return null;
  }
  return Math.ceil(
    -Math.log(1 - (rate * outstanding) / payment) / Math.log(1 + rate),
  );
}

export function computeDebt(
  debt: DebtEntity,
  payments: Pick<DebtPaymentEntity, 'amount' | 'interest'>[],
): DebtProgress {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const interestPaid = payments.reduce(
    (sum, payment) => sum + payment.interest,
    0,
  );
  const outstanding = Math.max(debt.principal - (paid - interestPaid), 0);

  return {
    ...debt,
    paid,
    interestPaid,
    outstanding,
    percent:
      debt.principal > 0
        ? Math.min(((debt.principal - outstanding) / debt.principal) * 100, 100)
        : 100,
    nextInterest: monthlyInterest(outstanding, debt.interest_rate),
    monthsLeft:
      debt.monthly_payment == null
        ? null
        : monthsToPayOff(outstanding, debt.interest_rate, debt.monthly_payment),
  };
}

export type AmortizationRow = {
  number: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

// Empty when the payment never pays the debt off; the last payment may be smaller.
export function amortizationSchedule(
  outstanding: number,
  yearlyRate: number,
  payment: number,
): AmortizationRow[] {
  const months = monthsToPayOff(outstanding, yearlyRate, payment);
  if (months == null || months === 0) {
    return [];
  }

  const rows: AmortizationRow[] = [];
  let balance = outstanding;
  for (let number = 1; number <= months && balance > 0; number++) {
    const interest = monthlyInterest(balance, yearlyRate);
    const due = Math.min(payment, balance + interest);
    const principal = due - interest;
    balance = Math.max(balance - principal, 0);
    rows.push({ number, payment: due, interest, principal, balance });
  }
  return rows;
}
