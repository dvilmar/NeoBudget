import { loadMappings } from '#server/db/mappings';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
});

describe('subscriptions app', () => {
  it('marks and unmarks a schedule without duplicating it', async () => {
    await app.handlers['subscription-set']({
      scheduleId: 's1',
      isSubscription: true,
    });
    await app.handlers['subscription-set']({
      scheduleId: 's1',
      isSubscription: true,
    });
    await app.handlers['subscription-set']({
      scheduleId: 's2',
      isSubscription: true,
    });
    expect(
      (await app.handlers['subscriptions-get']())
        .map(row => row.scheduleId)
        .sort(),
    ).toEqual(['s1', 's2']);

    await app.handlers['subscription-set']({
      scheduleId: 's1',
      isSubscription: false,
    });
    expect(await app.handlers['subscriptions-get']()).toEqual([
      { scheduleId: 's2', groupName: null },
    ]);

    await app.handlers['subscription-set']({
      scheduleId: 's2',
      isSubscription: true,
      groupName: 'Streaming',
    });
    expect(await app.handlers['subscriptions-get']()).toEqual([
      { scheduleId: 's2', groupName: 'Streaming' },
    ]);
  });
});
