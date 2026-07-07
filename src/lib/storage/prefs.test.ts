import { describe, it, expect } from 'vitest';
import { createPrefsRepository, type Prefs } from './prefs';
import { PREFS_KEY } from './keys';
import type { StorageAdapter } from './repo';

interface FakeAdapter extends StorageAdapter {
  store: Record<string, unknown>;
}

function fakeAdapter(initial: Record<string, unknown> = {}): FakeAdapter {
  const store: Record<string, unknown> = { ...initial };
  return {
    store,
    get(key) {
      return Promise.resolve(store[key]);
    },
    set(key, value) {
      store[key] = value;
      return Promise.resolve();
    },
  };
}

describe('prefs repository', () => {
  const valid: Prefs = { schemaVersion: 1, language: 'en' };

  it('returns null when nothing is stored', async () => {
    const repo = createPrefsRepository(fakeAdapter());
    expect(await repo.load()).toBeNull();
  });

  it('loads a valid preferences blob', async () => {
    const repo = createPrefsRepository(fakeAdapter({ [PREFS_KEY]: valid }));
    expect(await repo.load()).toEqual(valid);
  });

  it('returns null for a corrupt blob rather than throwing', async () => {
    const repo = createPrefsRepository(
      fakeAdapter({ [PREFS_KEY]: { schemaVersion: 1, language: 'fr' } }),
    );
    expect(await repo.load()).toBeNull();
  });

  it('saves preferences under the prefs key', async () => {
    const adapter = fakeAdapter();
    await createPrefsRepository(adapter).save(valid);
    expect(adapter.store[PREFS_KEY]).toEqual(valid);
  });
});
