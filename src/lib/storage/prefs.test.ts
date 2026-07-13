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
    remove(key) {
      Reflect.deleteProperty(store, key);
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

  it('loads a blob that carries display options', async () => {
    const withOptions: Prefs = {
      schemaVersion: 1,
      language: 'th',
      viewMode: 'preview',
      displayOptions: {
        fitToContent: false,
        showRoom: true,
        showSection: false,
        showEnglishNames: true,
        showSubjectId: true,
      },
    };
    const repo = createPrefsRepository(
      fakeAdapter({ [PREFS_KEY]: withOptions }),
    );
    expect(await repo.load()).toEqual(withOptions);
  });

  it('defaults show subject id off for a blob written before it existed', async () => {
    // showSubjectId is a defaulted field, so an older display options blob missing it still
    // validates and reads the id off rather than failing the whole preferences load.
    const repo = createPrefsRepository(
      fakeAdapter({
        [PREFS_KEY]: {
          schemaVersion: 1,
          language: 'th',
          displayOptions: {
            fitToContent: true,
            showRoom: true,
            showSection: true,
            showEnglishNames: true,
          },
        },
      }),
    );
    expect(await repo.load()).toEqual({
      schemaVersion: 1,
      language: 'th',
      displayOptions: {
        fitToContent: true,
        showRoom: true,
        showSection: true,
        showEnglishNames: true,
        showSubjectId: false,
      },
    });
  });

  it('rejects display options with a missing field', async () => {
    const repo = createPrefsRepository(
      fakeAdapter({
        [PREFS_KEY]: {
          schemaVersion: 1,
          language: 'th',
          displayOptions: { fitToContent: true },
        },
      }),
    );
    expect(await repo.load()).toBeNull();
  });
});
