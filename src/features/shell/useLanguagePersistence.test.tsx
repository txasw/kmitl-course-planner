import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useLanguagePersistence } from './useLanguagePersistence';
import { uiStore } from './uiStore';
import type { Prefs, PrefsRepository } from '@/lib/storage/prefs';

interface RecordingRepo extends PrefsRepository {
  saved: Prefs[];
}

function makeRepo(stored: Prefs | null): RecordingRepo {
  const saved: Prefs[] = [];
  return {
    saved,
    load: () => Promise.resolve(stored),
    save: (prefs) => {
      saved.push(prefs);
      return Promise.resolve();
    },
  };
}

// Flush the async load so the hydration and the persistence subscription settle.
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setLanguage('th');
  });
});

describe('useLanguagePersistence', () => {
  it('hydrates the stored language without writing it back', async () => {
    const repo = makeRepo({ schemaVersion: 1, language: 'en' });
    renderHook(() => {
      useLanguagePersistence(repo);
    });
    await flush();
    expect(uiStore.getState().language).toBe('en');
    expect(repo.saved).toHaveLength(0);
  });

  it('persists an explicit change made after hydration', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      useLanguagePersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(repo.saved).toEqual([{ schemaVersion: 1, language: 'en' }]);
  });
});
