// Made-up Trade Republic answers for the tests. No real account data:
// the ISINs, ids and amounts are invented.

import type {
  FetchLike,
  SocketFactory,
  SocketLike,
  TradeRepublicDeps,
} from './traderepublic-client';

export const ETF_ISIN = 'IE00TEST0001';
export const STOCK_ISIN = 'US00TEST0002';

function rows(entries: Record<string, string>) {
  return [
    {
      title: 'Transaction',
      type: 'table',
      data: Object.entries(entries).map(([title, text]) => ({
        title,
        detail: { text, type: 'text' },
      })),
    },
  ];
}

export const timelinePages: Record<string, unknown> = {
  first: {
    items: [
      {
        id: 'tx-buy-1',
        eventType: 'TRADE_INVOICE',
        status: 'EXECUTED',
        timestamp: '2026-01-10T09:30:00.000+0000',
        title: 'Example World ETF',
        icon: `logos/${ETF_ISIN}/v2`,
        amount: { value: -1001, currency: 'EUR' },
      },
      {
        id: 'tx-div-1',
        eventType: 'CREDIT',
        status: 'EXECUTED',
        timestamp: '2026-02-15T07:00:00.000+0000',
        title: 'Example Corp',
        icon: `logos/${STOCK_ISIN}/v2`,
        amount: { value: 8.5, currency: 'EUR' },
      },
      {
        id: 'tx-deposit-1',
        eventType: 'PAYMENT_INBOUND',
        status: 'EXECUTED',
        timestamp: '2026-01-02T10:00:00.000+0000',
        title: 'Deposit',
        amount: { value: 2000, currency: 'EUR' },
      },
    ],
    cursors: { after: 'page-2' },
  },
  'page-2': {
    items: [
      {
        id: 'tx-sell-1',
        eventType: 'TRADE_INVOICE',
        status: 'EXECUTED',
        timestamp: '2026-03-01T12:00:00.000+0000',
        title: 'Example World ETF',
        icon: `logos/${ETF_ISIN}/v2`,
        amount: { value: 548, currency: 'EUR' },
      },
      {
        id: 'tx-interest-1',
        eventType: 'INTEREST_PAYOUT',
        status: 'EXECUTED',
        timestamp: '2026-03-31T23:00:00.000+0000',
        title: 'Interest',
        amount: { value: 2.34, currency: 'EUR' },
      },
      {
        id: 'tx-cancelled-1',
        eventType: 'TRADE_INVOICE',
        status: 'CANCELED',
        timestamp: '2026-03-05T12:00:00.000+0000',
        title: 'Example World ETF',
        icon: `logos/${ETF_ISIN}/v2`,
        amount: { value: -50, currency: 'EUR' },
      },
    ],
    cursors: {},
  },
};

export const timelineDetails: Record<string, unknown> = {
  'tx-buy-1': {
    id: 'tx-buy-1',
    sections: rows({ Shares: '10', 'Share price': '€100.00', Fee: '€1.00' }),
  },
  'tx-div-1': {
    id: 'tx-div-1',
    sections: rows({ Shares: '20', Tax: '€1.50' }),
  },
  'tx-sell-1': {
    id: 'tx-sell-1',
    sections: rows({ Shares: '5', Fee: '€1.00', Tax: '€1.00' }),
  },
};

export const GOOD_PIN = '9753';
export const GOOD_CODE = '8642';
export const TR_PROCESS_ID = 'tr-process-0001';

export type FakeLog = {
  urls: string[];
  bodies: Array<string | undefined>;
  socketUrls: string[];
  socketHeaders: Array<Record<string, string>>;
  sent: string[];
  closed: number;
};

export function createFakeDeps(): { deps: TradeRepublicDeps; log: FakeLog } {
  const log: FakeLog = {
    urls: [],
    bodies: [],
    socketUrls: [],
    socketHeaders: [],
    sent: [],
    closed: 0,
  };

  const reply = (
    status: number,
    body: unknown,
    cookies: string[] = [],
  ): Awaited<ReturnType<FetchLike>> => ({
    status,
    headers: { getSetCookie: () => cookies },
    json: async () => body,
  });

  const fetch: FetchLike = async (url, init) => {
    log.urls.push(url);
    log.bodies.push(init.body);
    if (url === 'https://api.traderepublic.com/api/v1/auth/web/login') {
      const body = JSON.parse(init.body ?? '{}');
      return body.pin === GOOD_PIN
        ? reply(200, { processId: TR_PROCESS_ID, countdownInSeconds: 30 })
        : // TR echoes nothing useful, but make sure nothing of it leaks
          reply(401, { errors: [{ errorCode: 'BAD_PIN', meta: body }] });
    }
    if (
      url ===
      `https://api.traderepublic.com/api/v1/auth/web/login/${TR_PROCESS_ID}/${GOOD_CODE}`
    ) {
      return reply(200, {}, [
        'tr_session=session-cookie; Path=/; Secure; HttpOnly',
        'tr_refresh=refresh-cookie; Path=/; Secure; HttpOnly',
      ]);
    }
    return reply(400, { errors: [{ errorCode: 'VALIDATION_CODE_INVALID' }] });
  };

  const openSocket: SocketFactory = (url, headers) => {
    log.socketUrls.push(url);
    log.socketHeaders.push(headers);
    const socket: SocketLike = {
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send(data) {
        log.sent.push(data);
        setTimeout(() => answer(data), 0);
      },
      close() {
        log.closed++;
      },
    };
    const emit = (data: string) => socket.onmessage?.({ data });
    function answer(data: string) {
      if (data.startsWith('connect ')) {
        emit('connected');
        return;
      }
      const match = /^sub (\d+) (.*)$/.exec(data);
      if (!match) {
        return;
      }
      const [, id, json] = match;
      const request = JSON.parse(json);
      const payload =
        request.type === 'timelineTransactions'
          ? timelinePages[request.after ?? 'first']
          : timelineDetails[request.id];
      emit(
        payload
          ? `${id} A ${JSON.stringify(payload)}`
          : `${id} E {"message":"not found"}`,
      );
    }
    setTimeout(() => socket.onopen?.(), 0);
    return socket;
  };

  return { deps: { fetch, openSocket }, log };
}
