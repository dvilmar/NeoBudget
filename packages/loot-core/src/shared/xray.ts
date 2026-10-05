export type XRayHolding = {
  name: string;
  type: string;
  currency: string;
  // Market value in the base currency
  value: number;
};

export type XRayRule =
  | 'top-holding'
  | 'currency'
  | 'crypto'
  | 'diversification';

export type XRayFinding = {
  rule: XRayRule;
  ok: boolean;
  // Share in percent that triggered or passed the rule, or the number
  // of holdings for `diversification`
  value: number;
  // Name of the holding or currency behind the value
  subject: string | null;
};

const MAX_TOP_HOLDING = 25;
const MAX_CURRENCY = 80;
const MAX_CRYPTO = 20;
const MIN_HOLDINGS = 3;

function largest(totals: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const entry of totals) {
    if (!best || entry[1] > best[1]) {
      best = entry;
    }
  }
  return best;
}

export function xray(holdings: XRayHolding[]): XRayFinding[] {
  const held = holdings.filter(holding => holding.value > 0);
  const total = held.reduce((sum, holding) => sum + holding.value, 0);
  if (total <= 0) {
    return [];
  }

  const byName = new Map<string, number>();
  const byCurrency = new Map<string, number>();
  let crypto = 0;
  for (const holding of held) {
    byName.set(holding.name, (byName.get(holding.name) ?? 0) + holding.value);
    byCurrency.set(
      holding.currency,
      (byCurrency.get(holding.currency) ?? 0) + holding.value,
    );
    if (holding.type === 'crypto') {
      crypto += holding.value;
    }
  }

  const top = largest(byName);
  const currency = largest(byCurrency);
  const topShare = top ? (top[1] / total) * 100 : 0;
  const currencyShare = currency ? (currency[1] / total) * 100 : 0;
  const cryptoShare = (crypto / total) * 100;

  return [
    {
      rule: 'top-holding',
      ok: topShare <= MAX_TOP_HOLDING,
      value: topShare,
      subject: top ? top[0] : null,
    },
    {
      rule: 'currency',
      ok: currencyShare <= MAX_CURRENCY,
      value: currencyShare,
      subject: currency ? currency[0] : null,
    },
    {
      rule: 'crypto',
      ok: cryptoShare <= MAX_CRYPTO,
      value: cryptoShare,
      subject: null,
    },
    {
      rule: 'diversification',
      ok: byName.size >= MIN_HOLDINGS,
      value: byName.size,
      subject: null,
    },
  ];
}
