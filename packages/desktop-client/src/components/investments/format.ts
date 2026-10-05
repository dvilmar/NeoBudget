// Investment figures are decimals in each asset's currency, not integer budget-currency amounts.

export function formatMoney(
  value: number | null | undefined,
  currency: string,
  language: string,
): string {
  if (value == null) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    // Not an ISO code Intl knows, such as a stablecoin
    return `${formatNumber(value, language, 2)} ${currency}`;
  }
}

export function formatNumber(
  value: number,
  language: string,
  maximumFractionDigits = 8,
): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits }).format(
    value,
  );
}

export function formatPercent(value: number | null, language: string): string {
  if (value == null) {
    return '';
  }
  return new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value / 100);
}

// Accepts "1.5" and "1,5"; null for anything else.
export function parseDecimal(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function toErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return typeof error === 'string' ? error : JSON.stringify(error);
}
