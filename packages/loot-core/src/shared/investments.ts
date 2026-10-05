import type {
  InvestmentPosition,
  InvestmentTradeEntity,
  InvestmentValuation,
} from '#types/models';

type PositionTrade = Pick<
  InvestmentTradeEntity,
  'date' | 'type' | 'quantity' | 'price' | 'fee'
>;

// Below this, leftover quantity is floating point noise
const QUANTITY_EPSILON = 1e-9;

const TYPE_ORDER: Record<InvestmentTradeEntity['type'], number> = {
  buy: 0,
  dividend: 1,
  fee: 2,
  sell: 3,
};

function sortTrades<T extends PositionTrade>(trades: T[]): T[] {
  // Same-day buys go before sells so a round trip never oversells
  return [...trades].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

// Average cost method. `getRate` converts each trade (historical rate) to another currency.
export function computePosition<T extends PositionTrade>(
  trades: T[],
  getRate: (trade: T) => number = () => 1,
): InvestmentPosition {
  let quantity = 0;
  let costBasis = 0;
  let realizedGain = 0;
  let income = 0;
  let fees = 0;

  for (const trade of sortTrades(trades)) {
    const rate = getRate(trade);
    const amount = trade.quantity * trade.price * rate;
    const fee = (trade.fee || 0) * rate;
    fees += fee;

    switch (trade.type) {
      case 'buy':
        quantity += trade.quantity;
        costBasis += amount + fee;
        break;
      case 'sell': {
        // Units sold beyond what is held have no known cost
        const covered = Math.min(trade.quantity, Math.max(quantity, 0));
        const cost = quantity > 0 ? (costBasis / quantity) * covered : 0;
        costBasis -= cost;
        realizedGain += amount - fee - cost;
        quantity -= trade.quantity;
        break;
      }
      case 'dividend':
        income += amount - fee;
        break;
      case 'fee':
        realizedGain -= fee;
        break;
      default:
        throw new Error(`Unknown trade type: ${String(trade.type)}`);
    }

    if (Math.abs(quantity) < QUANTITY_EPSILON) {
      quantity = 0;
      costBasis = 0;
    }
  }

  return {
    quantity,
    costBasis,
    averageCost: quantity > 0 ? costBasis / quantity : 0,
    realizedGain,
    income,
    fees,
  };
}

// Like `computePosition` but sells consume the oldest lots first (FIFO).
export function computePositionFifo<T extends PositionTrade>(
  trades: T[],
  getRate: (trade: T) => number = () => 1,
): InvestmentPosition {
  const lots: { quantity: number; cost: number }[] = [];
  let realizedGain = 0;
  let income = 0;
  let fees = 0;

  for (const trade of sortTrades(trades)) {
    const rate = getRate(trade);
    const amount = trade.quantity * trade.price * rate;
    const fee = (trade.fee || 0) * rate;
    fees += fee;

    switch (trade.type) {
      case 'buy':
        lots.push({ quantity: trade.quantity, cost: amount + fee });
        break;
      case 'sell': {
        let remaining = trade.quantity;
        let cost = 0;
        while (remaining > QUANTITY_EPSILON && lots.length > 0) {
          const lot = lots[0];
          const taken = Math.min(lot.quantity, remaining);
          const takenCost = (lot.cost / lot.quantity) * taken;
          cost += takenCost;
          lot.quantity -= taken;
          lot.cost -= takenCost;
          remaining -= taken;
          if (lot.quantity < QUANTITY_EPSILON) {
            lots.shift();
          }
        }
        // Units sold beyond what is held have no known cost
        realizedGain += amount - fee - cost;
        break;
      }
      case 'dividend':
        income += amount - fee;
        break;
      case 'fee':
        realizedGain -= fee;
        break;
      default:
        throw new Error(`Unknown trade type: ${String(trade.type)}`);
    }
  }

  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const costBasis = lots.reduce((sum, lot) => sum + lot.cost, 0);
  return {
    quantity,
    costBasis,
    averageCost: quantity > 0 ? costBasis / quantity : 0,
    realizedGain,
    income,
    fees,
  };
}

export function valuePosition(
  position: Pick<InvestmentPosition, 'quantity' | 'costBasis'>,
  quote: { price: number; date: string } | null,
): InvestmentValuation {
  if (!quote) {
    return {
      price: null,
      priceDate: null,
      marketValue: null,
      unrealizedGain: null,
      unrealizedGainPercent: null,
    };
  }

  const marketValue = position.quantity * quote.price;
  const unrealizedGain = marketValue - position.costBasis;
  return {
    price: quote.price,
    priceDate: quote.date,
    marketValue,
    unrealizedGain,
    unrealizedGainPercent:
      position.costBasis > 0
        ? (unrealizedGain / position.costBasis) * 100
        : null,
  };
}
