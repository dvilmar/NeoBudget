import {
  ATTEMPT_WINDOW_MS,
  createAttemptLimiter,
  createPendingLogins,
  parseLoginInput,
  parseVerifyInput,
  PENDING_LOGIN_TTL_MS,
} from './traderepublic-guard';

describe('parseLoginInput', () => {
  it('accepts an international phone number and a 4 digit PIN', () => {
    expect(parseLoginInput({ phone: '+34 600-123 456', pin: '0123' })).toEqual({
      phone: '+34600123456',
      pin: '0123',
    });
  });

  it('rejects anything else', () => {
    for (const body of [
      null,
      'text',
      [],
      {},
      { phone: '600123456', pin: '1234' },
      { phone: '+0600123456', pin: '1234' },
      { phone: '+34600123456' + '1'.repeat(20), pin: '1234' },
      { phone: '+34 600 123 456 789 012 345 678', pin: '1234' },
      { phone: '+34600123456', pin: '123' },
      { phone: '+34600123456', pin: '12345' },
      { phone: '+34600123456', pin: 1234 },
      { phone: '+34600123456', pin: '12a4' },
      { phone: ['+34600123456'], pin: '1234' },
    ]) {
      expect(parseLoginInput(body)).toBeNull();
    }
  });
});

describe('parseVerifyInput', () => {
  const processId = '0b6f2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';

  it('accepts a handle and a 4 digit code', () => {
    expect(parseVerifyInput({ processId, code: '0042' })).toEqual({
      processId,
      code: '0042',
    });
  });

  it('rejects anything else', () => {
    for (const body of [
      null,
      { processId, code: '42' },
      { processId, code: '00420' },
      { processId, code: 42 },
      { processId: '../login', code: '0042' },
      { processId: processId + 'x', code: '0042' },
    ]) {
      expect(parseVerifyInput(body)).toBeNull();
    }
  });
});

describe('createPendingLogins', () => {
  let time = 0;
  const now = () => time;
  let pending: ReturnType<typeof createPendingLogins>;

  beforeEach(() => {
    time = 1_000_000;
    pending = createPendingLogins(now);
  });
  afterEach(() => pending.dispose());

  it('hands out a handle that works once', () => {
    const handle = pending.add('user-1', 'tr-process');
    expect(handle).not.toContain('tr-process');
    expect(pending.take(handle, 'user-1')).toBe('tr-process');
    expect(pending.take(handle, 'user-1')).toBeNull();
    expect(pending.size()).toBe(0);
  });

  it('forgets a login after five minutes', () => {
    const handle = pending.add('user-1', 'tr-process');
    time += PENDING_LOGIN_TTL_MS;
    expect(pending.take(handle, 'user-1')).toBeNull();
    expect(pending.size()).toBe(0);
  });

  it('cleans up expired logins on its own', () => {
    pending.add('user-1', 'tr-process');
    pending.add('user-2', 'tr-process-2');
    time += PENDING_LOGIN_TTL_MS + 1;
    expect(pending.size()).toBe(0);
  });

  it('does not let another user take a login', () => {
    const handle = pending.add('user-1', 'tr-process');
    expect(pending.take(handle, 'user-2')).toBeNull();
    expect(pending.take(handle, 'user-1')).toBe('tr-process');
  });

  it('keeps one login in progress per user', () => {
    const first = pending.add('user-1', 'tr-process');
    const second = pending.add('user-1', 'tr-process-2');
    expect(pending.take(first, 'user-1')).toBeNull();
    expect(pending.take(second, 'user-1')).toBe('tr-process-2');
  });
});

describe('createAttemptLimiter', () => {
  it('allows five attempts per key every ten minutes', () => {
    let time = 0;
    const limiter = createAttemptLimiter({ now: () => time });
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume(['user:a', 'ip:1'])).toBe(true);
    }
    expect(limiter.tryConsume(['user:a', 'ip:1'])).toBe(false);
    // Same address, another user: still blocked by the address
    expect(limiter.tryConsume(['user:b', 'ip:1'])).toBe(false);
    // Another address and user are not affected
    expect(limiter.tryConsume(['user:b', 'ip:2'])).toBe(true);

    time += ATTEMPT_WINDOW_MS;
    expect(limiter.tryConsume(['user:a', 'ip:1'])).toBe(true);
  });
});
