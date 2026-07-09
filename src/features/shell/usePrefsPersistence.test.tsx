import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { usePrefsPersistence } from './usePrefsPersistence';
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
    uiStore.getState().setViewMode('edit');
    uiStore.getState().setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
  });
});

describe('usePrefsPersistence', () => {
  it('hydrates the stored language and view mode without writing them back', async () => {
    const repo = makeRepo({
      schemaVersion: 1,
      language: 'en',
      viewMode: 'preview',
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().language).toBe('en');
    expect(uiStore.getState().viewMode).toBe('preview');
    expect(repo.saved).toHaveLength(0);
  });

  it('persists a language change with the current view mode', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'en',
        viewMode: 'edit',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
    ]);
  });

  it('persists a view mode change with the current language', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'th',
        viewMode: 'preview',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
    ]);
  });

  it('keeps the default view mode when the stored blob predates it', async () => {
    const repo = makeRepo({ schemaVersion: 1, language: 'en' });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().language).toBe('en');
    expect(uiStore.getState().viewMode).toBe('edit');
  });

  it('hydrates stored display options without writing them back', async () => {
    const displayOptions = {
      fitToContent: false,
      showRoom: false,
      showSection: true,
      showEnglishNames: false,
    };
    const repo = makeRepo({ schemaVersion: 1, language: 'th', displayOptions });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().displayOptions).toEqual(displayOptions);
    expect(repo.saved).toHaveLength(0);
  });

  it('persists a display option change with the current language and mode', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setDisplayOption('showRoom', false);
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'th',
        viewMode: 'edit',
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showRoom: false },
      },
    ]);
  });
});
