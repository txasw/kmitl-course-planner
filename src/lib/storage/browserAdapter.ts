// The concrete key value adapters over the browser storage areas. The local adapter
// serves the worker owned cache and the content owned plan, preference and search
// records; the session adapter serves the worker owned tab intents, which must not
// outlive the browser session. Each reads a single key and returns its value or
// undefined, narrowing through unknown because the storage API types the result
// loosely.

import { browser, type Browser } from 'wxt/browser';
import type { StorageAdapter } from './repo';

function createAreaAdapter(area: Browser.storage.StorageArea): StorageAdapter {
  return {
    async get(key) {
      const stored: unknown = await area.get(key);
      if (typeof stored === 'object' && stored !== null && key in stored) {
        return (stored as Record<string, unknown>)[key];
      }
      return undefined;
    },
    async set(key, value) {
      await area.set({ [key]: value });
    },
    async remove(key) {
      await area.remove(key);
    },
    async keys() {
      const all: unknown = await area.get(null);
      return typeof all === 'object' && all !== null ? Object.keys(all) : [];
    },
  };
}

export function createBrowserStorageAdapter(): StorageAdapter {
  return createAreaAdapter(browser.storage.local);
}

/**
 * The adapter over storage.session, or null where the area does not exist, which is
 * Firefox before 115. Callers then skip what needs the session area rather than
 * fall back to local storage, whose records would survive a browser restart.
 */
export function createSessionStorageAdapter(): StorageAdapter | null {
  const session = optionalSessionArea(browser.storage);
  return session === undefined ? null : createAreaAdapter(session);
}

// The types declare the session area always present, so reading it through this
// wider parameter type keeps the absence check that older Firefox builds need.
function optionalSessionArea(storage: {
  session?: Browser.storage.StorageArea;
}): Browser.storage.StorageArea | undefined {
  return storage.session;
}
