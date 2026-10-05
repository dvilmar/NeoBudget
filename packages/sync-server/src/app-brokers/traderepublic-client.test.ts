import {
  ALLOWED_SUBSCRIPTIONS,
  confirmLoginCode,
  downloadTimeline,
  isAllowedRestUrl,
  isAllowedSocketUrl,
  isAllowedSubscription,
  requestLoginCode,
} from './traderepublic-client';
import type { FetchLike } from './traderepublic-client';
import {
  createFakeDeps,
  GOOD_CODE,
  GOOD_PIN,
  TR_PROCESS_ID,
} from './traderepublic-fixtures';
import { needsDetail } from './traderepublic-timeline';

const PHONE = '+34600123456';

describe('read-only allow list', () => {
  it('only knows the two login calls on the TR host', () => {
    expect(
      isAllowedRestUrl('https://api.traderepublic.com/api/v1/auth/web/login'),
    ).toBe(true);
    expect(
      isAllowedRestUrl(
        'https://api.traderepublic.com/api/v1/auth/web/login/abc-1/1234',
      ),
    ).toBe(true);

    for (const url of [
      'http://api.traderepublic.com/api/v1/auth/web/login',
      'https://evil.example/api/v1/auth/web/login',
      'https://api.traderepublic.com.evil.example/api/v1/auth/web/login',
      'https://api.traderepublic.com/api/v1/auth/web/login?next=x',
      'https://api.traderepublic.com/api/v1/auth/web/login/a/1234/x',
      'https://api.traderepublic.com/api/v1/auth/web/login/../../order',
      'https://api.traderepublic.com/api/v1/order',
      'https://api.traderepublic.com/api/v1/payout',
      'https://api.traderepublic.com/api/v1/withdrawal',
      'https://api.traderepublic.com/api/v1/account',
      'not a url',
    ]) {
      expect(isAllowedRestUrl(url)).toBe(false);
    }
  });

  it('only opens the TR socket', () => {
    expect(isAllowedSocketUrl('wss://api.traderepublic.com')).toBe(true);
    expect(isAllowedSocketUrl('wss://evil.example')).toBe(false);
    expect(isAllowedSocketUrl('ws://api.traderepublic.com')).toBe(false);
  });

  it('only subscribes to the timeline', () => {
    expect([...ALLOWED_SUBSCRIPTIONS]).toEqual([
      'timelineTransactions',
      'timelineDetailV2',
    ]);
    for (const type of [
      'simpleCreateOrder',
      'cancelOrder',
      'priceAlarms',
      'createPriceAlarm',
      'cancelPriceAlarm',
      'withdrawal',
      'changeSavingsPlan',
      'cancelSavingsPlan',
      'createSavingsPlan',
      'portfolio',
    ]) {
      expect(isAllowedSubscription(type)).toBe(false);
    }
  });

  it('only calls allowed endpoints and subscriptions in a full import', async () => {
    const { deps, log } = createFakeDeps();
    const { processId } = await requestLoginCode(deps, PHONE, GOOD_PIN);
    const cookies = await confirmLoginCode(deps, processId, GOOD_CODE);
    await downloadTimeline(deps, cookies, needsDetail);

    expect(log.urls.every(isAllowedRestUrl)).toBe(true);
    expect(log.socketUrls).toEqual(['wss://api.traderepublic.com']);
    const types = log.sent
      .filter(message => message.startsWith('sub '))
      .map(message => JSON.parse(message.replace(/^sub \d+ /, '')).type);
    expect(types.length).toBeGreaterThan(0);
    expect(types.every(isAllowedSubscription)).toBe(true);
    for (const message of log.sent) {
      expect(message).toMatch(/^(connect 31 |sub \d+ |unsub \d+$)/);
    }
    expect(log.closed).toBe(1);
  });
});

describe('login', () => {
  it('sends the PIN only in the body of the first call', async () => {
    const { deps, log } = createFakeDeps();
    expect(await requestLoginCode(deps, PHONE, GOOD_PIN)).toEqual({
      processId: TR_PROCESS_ID,
      secondsToCode: 30,
    });
    expect(log.urls[0]).not.toContain(GOOD_PIN);
    expect(JSON.parse(log.bodies[0] ?? '')).toEqual({
      phoneNumber: PHONE,
      pin: GOOD_PIN,
    });
  });

  it('fails with a fixed error that echoes nothing', async () => {
    const { deps } = createFakeDeps();
    const error = await requestLoginCode(deps, PHONE, '1111').catch(e => e);
    expect(error.code).toBe('login-failed');
    expect(error.message).toBe('Trade Republic: login-failed');
    expect(JSON.stringify(error)).not.toContain('1111');
    expect(String(error.stack)).not.toContain('1111');
  });

  it('turns the session cookies into one header, without attributes', async () => {
    const { deps } = createFakeDeps();
    expect(await confirmLoginCode(deps, TR_PROCESS_ID, GOOD_CODE)).toBe(
      'tr_session=session-cookie; tr_refresh=refresh-cookie',
    );
    const error = await confirmLoginCode(deps, TR_PROCESS_ID, '0000').catch(
      e => e,
    );
    expect(error.code).toBe('invalid-code');
  });

  it('does not follow redirects', async () => {
    const init: Array<Parameters<FetchLike>[1]> = [];
    const fetch: FetchLike = async (_url, options) => {
      init.push(options);
      return {
        status: 302,
        headers: { getSetCookie: () => [] },
        json: async () => ({}),
      };
    };
    const { deps } = createFakeDeps();
    const error = await requestLoginCode(
      { ...deps, fetch },
      PHONE,
      GOOD_PIN,
    ).catch(e => e);
    expect(init[0].redirect).toBe('manual');
    expect(error.code).toBe('unavailable');
  });

  it('maps throttling to too-many-attempts', async () => {
    const fetch: FetchLike = async () => ({
      status: 429,
      headers: { getSetCookie: () => [] },
      json: async () => ({}),
    });
    const { deps } = createFakeDeps();
    const error = await requestLoginCode(
      { ...deps, fetch },
      PHONE,
      GOOD_PIN,
    ).catch(e => e);
    expect(error.code).toBe('too-many-attempts');
  });
});

describe('downloadTimeline', () => {
  it('follows the cursor and reads details of trades and dividends', async () => {
    const { deps, log } = createFakeDeps();
    const entries = await downloadTimeline(
      deps,
      'tr_session=session-cookie',
      needsDetail,
    );
    expect(entries.map(entry => entry.item.id)).toEqual([
      'tx-buy-1',
      'tx-div-1',
      'tx-deposit-1',
      'tx-sell-1',
      'tx-interest-1',
      'tx-cancelled-1',
    ]);
    expect(entries.find(e => e.item.id === 'tx-buy-1')?.detail).not.toBeNull();
    expect(entries.find(e => e.item.id === 'tx-deposit-1')?.detail).toBeNull();
    expect(log.socketHeaders[0]).toEqual({
      Cookie: 'tr_session=session-cookie',
    });
  });
});
