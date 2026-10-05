import { fetchFlexStatement, parseFlexStatement } from './ibkr';

const statement = `<FlexQueryResponse queryName="NeoBudget" type="AF">
<FlexStatements count="1"><FlexStatement accountId="U1234567">
<Trades>
<Trade accountId="U1234567" currency="EUR" fxRateToBase="1" assetCategory="STK" subCategory="ETF" symbol="VWCE" description="VANG FTSE AW USDA" isin="IE00BK5BQT80" listingExchange="IBIS2" tradeID="111" tradeDate="20260115" quantity="10" tradePrice="150.5" ibCommission="-1.25" ibCommissionCurrency="EUR" buySell="BUY" levelOfDetail="EXECUTION" />
<Trade accountId="U1234567" currency="USD" fxRateToBase="0.9" assetCategory="STK" subCategory="COMMON" symbol="BRK B" description="BERKSHIRE HATHAWAY &amp; CO" isin="US0846707026" listingExchange="NYSE" tradeID="112" tradeDate="20260210" quantity="-2" tradePrice="480" ibCommission="-1" ibCommissionCurrency="USD" buySell="SELL" levelOfDetail="EXECUTION" />
<Trade accountId="U1234567" currency="USD" assetCategory="STK" symbol="BRK B" tradeID="112" tradeDate="20260210" quantity="-2" tradePrice="480" levelOfDetail="CLOSED_LOT" />
<Trade accountId="U1234567" currency="USD" assetCategory="CASH" symbol="EUR.USD" tradeID="113" tradeDate="20260210" quantity="1000" tradePrice="1.1" levelOfDetail="EXECUTION" />
</Trades>
<CashTransactions>
<CashTransaction accountId="U1234567" currency="USD" fxRateToBase="0.9" assetCategory="STK" symbol="AAPL" description="AAPL CASH DIVIDEND" isin="US0378331005" listingExchange="NASDAQ" reportDate="20260301" amount="12.5" type="Dividends" transactionID="201" />
<CashTransaction accountId="U1234567" currency="USD" fxRateToBase="0.9" assetCategory="STK" symbol="AAPL" description="AAPL US TAX" isin="US0378331005" listingExchange="NASDAQ" reportDate="20260301" amount="-1.88" type="Withholding Tax" transactionID="202" />
<CashTransaction accountId="U1234567" currency="EUR" reportDate="20260302" amount="500" type="Deposits/Withdrawals" transactionID="203" />
</CashTransactions>
</FlexStatement></FlexStatements></FlexQueryResponse>`;

describe('parseFlexStatement', () => {
  const { trades, skipped } = parseFlexStatement(statement);

  it('reads buys and sells from the executions only', () => {
    expect(trades.slice(0, 2)).toEqual([
      {
        importedId: 'ibkr:111',
        date: '2026-01-15',
        type: 'buy',
        symbol: 'VWCE',
        name: 'VANG FTSE AW USDA',
        isin: 'IE00BK5BQT80',
        assetType: 'etf',
        currency: 'EUR',
        quantity: 10,
        price: 150.5,
        fee: 1.25,
        fxRate: 1,
        priceSource: 'yahoo',
        priceSourceId: 'VWCE.DE',
      },
      {
        importedId: 'ibkr:112',
        date: '2026-02-10',
        type: 'sell',
        symbol: 'BRK B',
        name: 'BERKSHIRE HATHAWAY & CO',
        isin: 'US0846707026',
        assetType: 'stock',
        currency: 'USD',
        quantity: 2,
        price: 480,
        fee: 1,
        fxRate: 0.9,
        priceSource: 'yahoo',
        priceSourceId: 'BRK-B',
      },
    ]);
  });

  it('reads dividends as income and withholding tax as a fee', () => {
    expect(trades.slice(2)).toMatchObject([
      {
        importedId: 'ibkr:201',
        date: '2026-03-01',
        type: 'dividend',
        symbol: 'AAPL',
        quantity: 1,
        price: 12.5,
        fee: 0,
      },
      { importedId: 'ibkr:202', type: 'fee', quantity: 0, price: 0, fee: 1.88 },
    ]);
    expect(trades).toHaveLength(4);
  });

  it('counts what it leaves out', () => {
    expect(skipped).toEqual({ CASH: 1 });
  });
});

describe('fetchFlexStatement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(bodies: string[]) {
    const fetchMock = vi.fn(
      async (_url: string) => new Response(bodies.shift()),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('asks for the statement and waits until it is ready', async () => {
    const fetchMock = stubFetch([
      '<FlexStatementResponse><Status>Success</Status><ReferenceCode>987</ReferenceCode></FlexStatementResponse>',
      '<FlexStatementResponse><Status>Warn</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement generation in progress.</ErrorMessage></FlexStatementResponse>',
      statement,
    ]);

    const result = await fetchFlexStatement('tok en', '555', 0);

    expect(result.trades).toHaveLength(4);
    expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
      expect.stringContaining('/SendRequest?t=tok%20en&v=3&q=555'),
      expect.stringContaining('/GetStatement?t=tok%20en&v=3&q=987'),
      expect.stringContaining('/GetStatement?t=tok%20en&v=3&q=987'),
    ]);
  });

  it('throws the reason Interactive Brokers gives', async () => {
    stubFetch([
      '<FlexStatementResponse><Status>Fail</Status><ErrorCode>1015</ErrorCode><ErrorMessage>Token is invalid.</ErrorMessage></FlexStatementResponse>',
    ]);

    await expect(fetchFlexStatement('bad', '555', 0)).rejects.toThrow(
      'Token is invalid.',
    );
  });
});
