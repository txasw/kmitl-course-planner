import { describe, expect, it } from 'vitest';
import { createCacheStore, hashKey, stableParamString } from './cache';
import type { StorageAdapter } from '../storage/repo';

function fakeAdapter(): StorageAdapter & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

describe('createCacheStore', () => {
  it('serves an unexpired entry from memory', async () => {
    const store = createCacheStore(fakeAdapter());
    await store.set('k', { a: 1 }, 100);
    expect(await store.get('k', 99)).toEqual({
      value: { a: 1 },
      source: 'memory',
    });
  });

  it('serves from storage after the memory tier is lost, then hydrates', async () => {
    const adapter = fakeAdapter();
    await createCacheStore(adapter).set('k', 42, 100);
    // A fresh store models an ephemeral worker restart: memory is empty but the
    // durable storage tier survives.
    const revived = createCacheStore(adapter);
    expect(await revived.get('k', 50)).toEqual({
      value: 42,
      source: 'storage',
    });
    // The storage hit hydrates memory, so the next read is a memory hit.
    expect((await revived.get('k', 50))?.source).toBe('memory');
  });

  it('clears every entry from both memory and storage', async () => {
    const adapter = fakeAdapter();
    const store = createCacheStore(adapter);
    await store.set('a', 1, 100);
    await store.set('b', 2, 100);
    await store.clear();
    expect(adapter.store.size).toBe(0);
    // A miss even before expiry, from both tiers, confirms memory was cleared too.
    expect(await store.get('a', 50)).toBeNull();
    expect(await store.get('b', 50)).toBeNull();
  });

  it('treats an entry at or past its expiry as a miss', async () => {
    const store = createCacheStore(fakeAdapter());
    await store.set('k', 1, 100);
    expect(await store.get('k', 100)).toBeNull();
    expect(await store.get('k', 150)).toBeNull();
  });

  it('ignores an expired entry read from storage', async () => {
    const adapter = fakeAdapter();
    adapter.store.set('k', { value: 1, expiresAt: 10 });
    expect(await createCacheStore(adapter).get('k', 20)).toBeNull();
  });

  it('ignores a stored value that is not a cache entry', async () => {
    const adapter = fakeAdapter();
    adapter.store.set('k', 'garbage');
    expect(await createCacheStore(adapter).get('k', 0)).toBeNull();
  });

  it('evicts the oldest key from memory past the cap but keeps storage', async () => {
    const adapter = fakeAdapter();
    const store = createCacheStore(adapter, 2);
    await store.set('a', 1, 1000);
    await store.set('b', 2, 1000);
    await store.set('c', 3, 1000);
    // 'a' was evicted from memory but is still durable in storage.
    expect((await store.get('a', 0))?.source).toBe('storage');
  });
});

describe('cache key helpers', () => {
  it('serializes params deterministically regardless of key order', () => {
    expect(stableParamString({ b: '2', a: '1' })).toBe('a=1&b=2');
    expect(stableParamString({ a: '1', b: '2' })).toBe(
      stableParamString({ b: '2', a: '1' }),
    );
  });

  it('hashes stably and separates distinct inputs', () => {
    expect(hashKey('abc')).toBe(hashKey('abc'));
    expect(hashKey('abc')).not.toBe(hashKey('abd'));
  });
});
