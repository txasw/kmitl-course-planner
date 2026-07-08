// The two tier response cache the worker owns: an in memory Map bounded by a
// small LRU cap, backed by a durable key value store (browser.storage.local in
// the worker, an in memory fake in tests). Expiry is lazy on read. The store is
// generic over a string key; callers derive that key from the endpoint and its
// normalized params. Because the MV3 worker is ephemeral, the memory tier is per
// lifetime and the storage tier is the durable one.

import type { StorageAdapter } from '../storage/repo';
import { CACHE_PREFIX } from '../storage/keys';

export interface CacheEntry {
  value: unknown;
  /** Epoch milliseconds after which the entry is stale. */
  expiresAt: number;
}

export interface CacheHit {
  value: unknown;
  source: 'memory' | 'storage';
}

const DEFAULT_MEMORY_CAP = 50;

/** Deterministic serialization of query params with keys sorted. */
export function stableParamString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ''}`)
    .join('&');
}

/** 32 bit FNV-1a hash rendered in base36 to bound a storage key's length. */
export function hashKey(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function isCacheEntry(value: unknown): value is CacheEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number'
  );
}

export interface CacheStore {
  get(key: string, now: number): Promise<CacheHit | null>;
  set(key: string, value: unknown, expiresAt: number): Promise<void>;
  /** Drop every cached entry from memory and storage. Debug tooling only. */
  clear(): Promise<void>;
}

export function createCacheStore(
  adapter: StorageAdapter,
  memoryCap = DEFAULT_MEMORY_CAP,
): CacheStore {
  const memory = new Map<string, CacheEntry>();
  // Every key ever written this session, so clear can remove entries that have
  // since been evicted from the memory map but remain in storage.
  const written = new Set<string>();

  function remember(key: string, entry: CacheEntry): void {
    // Refresh recency by reinserting, then evict the oldest key when the cap is
    // exceeded. A Map iterates in insertion order, so the first key is oldest.
    memory.delete(key);
    memory.set(key, entry);
    if (memory.size > memoryCap) {
      const oldest = memory.keys().next().value;
      if (oldest !== undefined) {
        memory.delete(oldest);
      }
    }
  }

  return {
    async get(key, now) {
      const inMemory = memory.get(key);
      if (inMemory) {
        if (inMemory.expiresAt > now) {
          remember(key, inMemory);
          return { value: inMemory.value, source: 'memory' };
        }
        memory.delete(key);
      }
      const stored: unknown = await adapter.get(key);
      if (isCacheEntry(stored) && stored.expiresAt > now) {
        remember(key, stored);
        return { value: stored.value, source: 'storage' };
      }
      return null;
    },
    async set(key, value, expiresAt) {
      const entry: CacheEntry = { value, expiresAt };
      remember(key, entry);
      written.add(key);
      await adapter.set(key, entry);
    },
    async clear() {
      memory.clear();
      // Enumerate storage when the adapter supports it so entries from an earlier
      // worker session are dropped too, scoped to the cache namespace so plans and
      // preferences survive. Without enumeration fall back to this session's keys.
      const keys = adapter.keys
        ? (await adapter.keys()).filter((key) => key.startsWith(CACHE_PREFIX))
        : [...written];
      written.clear();
      await Promise.all(keys.map((key) => adapter.remove(key)));
    },
  };
}
