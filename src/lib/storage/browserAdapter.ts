// The concrete key value adapter over browser.storage.local. The worker owned
// cache uses it now; the content owned plan repository will use it in a later
// phase. It reads a single key and returns its value or undefined, narrowing
// through unknown because the polyfill types the result as any.

import { browser } from 'wxt/browser';
import type { StorageAdapter } from './repo';

export function createBrowserStorageAdapter(): StorageAdapter {
  return {
    async get(key) {
      const stored: unknown = await browser.storage.local.get(key);
      if (typeof stored === 'object' && stored !== null && key in stored) {
        return (stored as Record<string, unknown>)[key];
      }
      return undefined;
    },
    async set(key, value) {
      await browser.storage.local.set({ [key]: value });
    },
  };
}
