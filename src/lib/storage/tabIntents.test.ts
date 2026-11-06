import { describe, expect, it } from 'vitest';
import { createTabIntentStore, tabIntentsRecordSchema } from './tabIntents';
import { TAB_INTENTS_KEY, TAB_INTENT_TTL_MS } from './keys';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const START = Date.parse('2026-11-06T08:00:00.000Z');

function setup(initial: Record<string, unknown> = {}) {
  const storage = createMemoryStorage(initial);
  const clock = { at: START };
  const store = createTabIntentStore(storage, { now: () => clock.at });
  return { storage, clock, store };
}

function storedTabs(storage: ReturnType<typeof createMemoryStorage>) {
  const record = tabIntentsRecordSchema.parse(storage.store[TAB_INTENTS_KEY]);
  return record.intents.map((intent) => intent.tabId);
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('tab intent store', () => {
  it('consumes an open intent once', async () => {
    const { store } = setup();
    await store.add(7, 'open');
    expect(await store.consume(7)).toBe(true);
    expect(await store.consume(7)).toBe(false);
  });

  it('does not consume an intent of another tab or kind', async () => {
    const { store } = setup();
    await store.add(7, 'welcome');
    await store.add(8, 'open');
    expect(await store.consume(7)).toBe(false);
    expect(await store.pendingWelcomeTab()).toBe(7);
    expect(await store.pendingOpenTab()).toBe(8);
  });

  it('reports an expired intent as absent and prunes it on the next write', async () => {
    const { storage, clock, store } = setup();
    await store.add(7, 'open');
    clock.at += TAB_INTENT_TTL_MS;
    expect(await store.consume(7)).toBe(false);
    expect(await store.pendingOpenTab()).toBeNull();
    expect(storedTabs(storage)).toEqual([7]);
    await store.add(8, 'open');
    expect(storedTabs(storage)).toEqual([8]);
  });

  it('keeps an intent until just before it expires', async () => {
    const { clock, store } = setup();
    await store.add(7, 'open');
    clock.at += TAB_INTENT_TTL_MS - 1;
    expect(await store.consume(7)).toBe(true);
  });

  it('refreshes the expiry when the same intent is added again', async () => {
    const { storage, clock, store } = setup();
    await store.add(7, 'open');
    clock.at += TAB_INTENT_TTL_MS - 1;
    await store.add(7, 'open');
    clock.at += 2;
    expect(storedTabs(storage)).toEqual([7]);
    expect(await store.consume(7)).toBe(true);
  });

  it('answers the newest pending open tab', async () => {
    const { clock, store } = setup();
    await store.add(3, 'open');
    clock.at += 10;
    await store.add(4, 'open');
    expect(await store.pendingOpenTab()).toBe(4);
  });

  it('resolves a consume queued behind an in flight step after it', async () => {
    const { store } = setup();
    const created = deferred<number>();
    const step = store.run(async (intents) => {
      const tabId = await created.promise;
      await intents.add(tabId, 'open');
      return tabId;
    });
    const consumed = store.consume(12);
    created.resolve(12);
    expect(await step).toBe(12);
    expect(await consumed).toBe(true);
  });

  it('moves on after a step fails', async () => {
    const { store } = setup();
    const failed = store.run(() => Promise.reject(new Error('no tab')));
    await expect(failed).rejects.toThrow('no tab');
    await store.add(5, 'open');
    expect(await store.consume(5)).toBe(true);
  });

  it('answers the tab of an unexpired welcome intent', async () => {
    const { clock, store } = setup();
    expect(await store.pendingWelcomeTab()).toBeNull();
    await store.add(9, 'welcome');
    expect(await store.pendingWelcomeTab()).toBe(9);
    clock.at += TAB_INTENT_TTL_MS;
    expect(await store.pendingWelcomeTab()).toBeNull();
  });

  it('grants the welcome once per session', async () => {
    const { storage, store } = setup();
    expect(await store.claimWelcome(3)).toBe(true);
    expect(await store.claimWelcome(3)).toBe(false);
    expect(await store.claimWelcome(4)).toBe(false);
    const record = tabIntentsRecordSchema.parse(storage.store[TAB_INTENTS_KEY]);
    expect(record.welcomeClaimedAt).toBe(new Date(START).toISOString());
  });

  it('grants the welcome to the tab its intent names and removes the intent', async () => {
    const { store } = setup();
    await store.add(9, 'welcome');
    expect(await store.claimWelcome(9)).toBe(true);
    expect(await store.pendingWelcomeTab()).toBeNull();
  });

  it('denies another tab while a welcome intent names a different tab', async () => {
    const { store } = setup();
    await store.add(9, 'welcome');
    expect(await store.claimWelcome(3)).toBe(false);
    expect(await store.claimWelcome(9)).toBe(true);
  });

  it('grants any tab after the welcome intent expires', async () => {
    const { clock, store } = setup();
    await store.add(9, 'welcome');
    clock.at += TAB_INTENT_TTL_MS;
    expect(await store.claimWelcome(3)).toBe(true);
  });

  it.each([
    ['a wrong schema version', { schemaVersion: 2, intents: [] }],
    [
      'an intent with an unknown kind',
      {
        schemaVersion: 1,
        intents: [{ tabId: 7, kind: 'close', expiresAt: START + 1000 }],
      },
    ],
    ['a value that is not an object', 'intents'],
  ])('treats %s as empty', async (_label, blob) => {
    const { store } = setup({ [TAB_INTENTS_KEY]: blob });
    expect(await store.consume(7)).toBe(false);
    expect(await store.pendingOpenTab()).toBeNull();
    expect(await store.claimWelcome(7)).toBe(true);
  });

  it('writes only under the tab intents key', async () => {
    const { storage, store } = setup();
    await store.add(1, 'open');
    await store.consume(1);
    await store.claimWelcome(1);
    const keys = storage.set.mock.calls.map(([key]) => key);
    expect(new Set(keys)).toEqual(new Set([TAB_INTENTS_KEY]));
  });

  it('uses the wall clock and the default ttl without options', async () => {
    const store = createTabIntentStore(createMemoryStorage());
    await store.add(2, 'open');
    expect(await store.pendingOpenTab()).toBe(2);
  });
});
