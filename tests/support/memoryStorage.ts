// An in memory key value adapter for storage repository tests. It keeps the stored
// values in a plain record the test can seed and inspect, and spies on set so a test
// can assert which keys a repository wrote and how often.

import { vi } from 'vitest';
import type { StorageAdapter } from '@/lib/storage/repo';

export interface MemoryStorage extends StorageAdapter {
  store: Record<string, unknown>;
  set: ReturnType<typeof vi.fn<StorageAdapter['set']>>;
}

export function createMemoryStorage(
  initial: Record<string, unknown> = {},
): MemoryStorage {
  const store: Record<string, unknown> = { ...initial };
  return {
    store,
    get(key) {
      return Promise.resolve(store[key]);
    },
    set: vi.fn<StorageAdapter['set']>((key, value) => {
      store[key] = value;
      return Promise.resolve();
    }),
    remove(key) {
      Reflect.deleteProperty(store, key);
      return Promise.resolve();
    },
  };
}
