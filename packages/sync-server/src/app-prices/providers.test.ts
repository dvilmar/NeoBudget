import {
  parseCoinGeckoChart,
  parseEcbRates,
  parseYahooChart,
} from './providers';

// 2026-10-01 and 2026-10-02 at 07:00 UTC, the Xetra opening time
const OPEN_1 = 1790838000;
const OPEN_2 = 1790924400;

function yahoo(meta: Record<string, unknown>, closes: Array<number | null>) {
  return {
    chart: {
      result: [
        {
          meta,
          timestamp: [OPEN_1, OPEN_2],
          indicators: { quote: [{ close: closes }] },
        },
      ],
      error: null,
    },
  };
}

describe('parseYahooChart', () => {
  it('returns one price per trading day, ending with the live price', () => {
    const result = parseYahooChart(
      yahoo(
        {
          currency: 'EUR',
          gmtoffset: 7200,
          regularMarketPrice: 171.14,
          regularMarketTime: OPEN_2 + 3600,
        },
        [169.38, 170.9],
      ),
    );

    expect(result).toEqual({
      currency: 'EUR',
      quotes: [
        { date: '2026-10-01', price: 169.38 },
        { date: '2026-10-02', price: 171.14 },
      ],
    });
  });

  it('skips days without a close', () => {
    const result = parseYahooChart(yahoo({ currency: 'USD' }, [null, 10]));

    expect(result.quotes).toEqual([{ date: '2026-10-02', price: 10 }]);
  });

  it('reads the trading day in the exchange time zone', () => {
    // 23:00 UTC on 2026-09-30 is already 2026-10-01 in Sydney
    const result = parseYahooChart({
      chart: {
        result: [
          {
            meta: { currency: 'AUD', gmtoffset: 36000 },
            timestamp: [OPEN_1 - 8 * 3600],
            indicators: { quote: [{ close: [50] }] },
          },
        ],
      },
    });

    expect(result.quotes).toEqual([{ date: '2026-10-01', price: 50 }]);
  });

  it('converts pence to pounds', () => {
    const result = parseYahooChart(yahoo({ currency: 'GBp' }, [9500, 9600]));

    expect(result.currency).toBe('GBP');
    expect(result.quotes.map(quote => quote.price)).toEqual([95, 96]);
  });

  it('throws the reason given for an unknown symbol', () => {
    expect(() =>
      parseYahooChart({
        chart: { result: null, error: { description: 'No data found' } },
      }),
    ).toThrow('No data found');
  });
});

describe('parseCoinGeckoChart', () => {
  it('keeps the last price of each day', () => {
    const day = Date.UTC(2026, 9, 1);
    const result = parseCoinGeckoChart(
      {
        prices: [
          [day, 76000],
          [day + 3600000, 76500],
          [day + 24 * 3600000, 77000],
        ],
      },
      'eur',
    );

    expect(result).toEqual({
      currency: 'EUR',
      quotes: [
        { date: '2026-10-01', price: 76500 },
        { date: '2026-10-02', price: 77000 },
      ],
    });
  });

  it('throws when the coin is unknown', () => {
    expect(() =>
      parseCoinGeckoChart({ error: 'coin not found' }, 'eur'),
    ).toThrow('coin not found');
  });
});

describe('parseEcbRates', () => {
  it('reads every day of the file', () => {
    const xml = `<Cube>
      <Cube time='2026-10-02'>
        <Cube currency='USD' rate='1.1225'/>
        <Cube currency='GBP' rate='0.85033'/>
      </Cube>
      <Cube time="2026-10-01">
        <Cube currency="USD" rate="1.1200"/>
      </Cube>
    </Cube>`;

    expect(parseEcbRates(xml)).toEqual([
      { base: 'EUR', quote: 'USD', date: '2026-10-02', rate: 1.1225 },
      { base: 'EUR', quote: 'GBP', date: '2026-10-02', rate: 0.85033 },
      { base: 'EUR', quote: 'USD', date: '2026-10-01', rate: 1.12 },
    ]);
  });
});
