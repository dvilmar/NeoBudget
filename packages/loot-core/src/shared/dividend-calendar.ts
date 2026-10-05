export type DividendTrade = {
  asset_id: string;
  date: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  fx_rate: number | null;
};

export type DividendMonth = {
  // YYYY-MM
  month: string;
  received: number;
  estimated: number;
};

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + delta;
  const newYear = Math.floor(index / 12);
  return `${newYear}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function dividendAmount(trade: DividendTrade): number {
  return (
    (trade.quantity * trade.price - (trade.fee || 0)) * (trade.fx_rate ?? 1)
  );
}

// Last 12 months plus a forecast that repeats each asset's payout from a year earlier. Base currency.
export function buildDividendCalendar(
  trades: DividendTrade[],
  today: string,
  options: { futureMonths?: number; activeAssetIds?: Set<string> } = {},
): DividendMonth[] {
  const futureMonths = options.futureMonths ?? 3;
  const current = today.slice(0, 7);
  const first = shiftMonth(current, -11);

  const byAssetAndMonth = new Map<string, Map<string, number>>();
  const received = new Map<string, number>();

  for (const trade of trades) {
    if (trade.type !== 'dividend') {
      continue;
    }
    const month = trade.date.slice(0, 7);
    if (month < first || month > current) {
      continue;
    }
    const amount = dividendAmount(trade);
    received.set(month, (received.get(month) ?? 0) + amount);
    const months = byAssetAndMonth.get(trade.asset_id) ?? new Map();
    months.set(month, (months.get(month) ?? 0) + amount);
    byAssetAndMonth.set(trade.asset_id, months);
  }

  const result: DividendMonth[] = [];
  for (let i = -11; i <= futureMonths; i++) {
    const month = shiftMonth(current, i);
    if (i <= 0) {
      result.push({ month, received: received.get(month) ?? 0, estimated: 0 });
      continue;
    }
    const previous = shiftMonth(month, -12);
    let estimated = 0;
    for (const [assetId, months] of byAssetAndMonth) {
      if (options.activeAssetIds && !options.activeAssetIds.has(assetId)) {
        continue;
      }
      estimated += months.get(previous) ?? 0;
    }
    result.push({ month, received: 0, estimated });
  }
  return result;
}
