import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { usePrefsPersistence } from './usePrefsPersistence';
import { uiStore } from './uiStore';
import { catalogStore } from '@/features/catalog/catalogStore';
import {
  createPrefsRepository,
  type Prefs,
  type PrefsRepository,
} from '@/lib/storage/prefs';
import { PREFS_KEY } from '@/lib/storage/keys';

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
    uiStore.setState({ selectedTemplate: null });
    uiStore.getState().setCurriculumProfile(null);
    uiStore.getState().setSuggestObjective('coverAll');
    uiStore.getState().setSuggestPreference('balanced');
    uiStore.getState().setTimetableView('day');
    catalogStore.getState().resetFilter();
  });
});

const NO_HIDES = { full: false, conflicting: false, unscheduled: false };

const PROFILE = {
  facultyId: '01',
  departmentId: '05',
  curriculumId: '137',
  classYear: '1',
};

describe('usePrefsPersistence', () => {
  it('hydrates the stored language without writing it back', async () => {
    const repo = makeRepo({ schemaVersion: 1, language: 'en' });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().language).toBe('en');
    expect(repo.saved).toHaveLength(0);
  });

  it('persists a language change with the other preferences', async () => {
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
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        suggestObjective: 'coverAll',
        suggestPreference: 'balanced',
        catalogHides: NO_HIDES,
      },
    ]);
  });

  it('writes nothing when the panel mode changes', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    expect(repo.saved).toHaveLength(0);
  });

  // An older build wrote the last panel mode. Read through the real repository, the blob
  // keeps the language and opens in edit, and the next save carries no mode.
  it('ignores a view mode stored by an older build', async () => {
    const store: Record<string, unknown> = {
      [PREFS_KEY]: { schemaVersion: 1, language: 'en', viewMode: 'preview' },
    };
    const repo = createPrefsRepository({
      get: (key) => Promise.resolve(store[key]),
      set: (key, value) => {
        store[key] = value;
        return Promise.resolve();
      },
      remove: (key) => {
        Reflect.deleteProperty(store, key);
        return Promise.resolve();
      },
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().language).toBe('en');
    expect(uiStore.getState().viewMode).toBe('edit');

    act(() => {
      uiStore.getState().setLanguage('th');
    });
    await flush();
    expect(store[PREFS_KEY]).not.toHaveProperty('viewMode');
    expect(store[PREFS_KEY]).toMatchObject({ language: 'th' });
  });

  it('hydrates stored display options without writing them back', async () => {
    const displayOptions = {
      showRoom: false,
      showSection: true,
      showSubjectId: true,
      showExams: true,
      nameLanguage: 'en' as const,
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
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showRoom: false },
        suggestObjective: 'coverAll',
        suggestPreference: 'balanced',
        catalogHides: NO_HIDES,
      },
    ]);
  });

  it('hydrates the stored export template without writing it back', async () => {
    const repo = makeRepo({
      schemaVersion: 1,
      language: 'th',
      exportTemplate: 'phone-wallpaper',
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().selectedTemplate).toBe('phone-wallpaper');
    expect(repo.saved).toHaveLength(0);
  });

  it('leaves an unchosen export template unsaved', async () => {
    // With no choice, the saved prefs carry no template, so the preview keeps resolving it
    // from the stage shape rather than freezing the default as a choice.
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0]).not.toHaveProperty('exportTemplate');
    expect(uiStore.getState().selectedTemplate).toBeNull();
  });

  it('persists an export template change', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setSelectedTemplate('print-a4');
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'th',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        exportTemplate: 'print-a4',
        suggestObjective: 'coverAll',
        suggestPreference: 'balanced',
        catalogHides: NO_HIDES,
      },
    ]);
  });

  it('hydrates the stored suggestion options without writing them back', async () => {
    const repo = makeRepo({
      schemaVersion: 1,
      language: 'th',
      suggestObjective: 'maxCredits',
      suggestPreference: 'fewerDays',
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().suggestObjective).toBe('maxCredits');
    expect(uiStore.getState().suggestPreference).toBe('fewerDays');
    expect(repo.saved).toHaveLength(0);
  });

  it('persists a suggestion option change', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setSuggestPreference('morning');
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'th',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        suggestObjective: 'coverAll',
        suggestPreference: 'morning',
        catalogHides: NO_HIDES,
      },
    ]);
  });

  it('writes nothing when the timetable view changes', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setTimetableView('week');
    });
    expect(repo.saved).toHaveLength(0);
  });

  it('hydrates a stored curriculum profile without writing it back', async () => {
    const repo = makeRepo({
      schemaVersion: 1,
      language: 'th',
      curriculumProfile: PROFILE,
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    expect(uiStore.getState().curriculumProfile).toEqual(PROFILE);
    expect(repo.saved).toHaveLength(0);
  });

  it('persists a chosen curriculum profile with the other preferences', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      uiStore.getState().setCurriculumProfile(PROFILE);
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'th',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        curriculumProfile: PROFILE,
        suggestObjective: 'coverAll',
        suggestPreference: 'balanced',
        catalogHides: NO_HIDES,
      },
    ]);
  });

  it('hydrates the stored catalog hide toggles without writing them back', async () => {
    const repo = makeRepo({
      schemaVersion: 1,
      language: 'th',
      catalogHides: { full: true, conflicting: true, unscheduled: false },
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();
    const { filter } = catalogStore.getState();
    expect(filter.hideFull).toBe(true);
    expect(filter.hideConflicting).toBe(true);
    expect(filter.hideUnscheduled).toBe(false);
    expect(repo.saved).toHaveLength(0);
  });

  it('keeps a hide toggle changed during the read over the stored one', async () => {
    const repo = makeRepo({
      schemaVersion: 1,
      language: 'th',
      catalogHides: { full: true, conflicting: false, unscheduled: false },
    });
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    act(() => {
      catalogStore.getState().setHideUnscheduled(true);
    });
    await flush();
    const { filter } = catalogStore.getState();
    expect(filter.hideFull).toBe(false);
    expect(filter.hideUnscheduled).toBe(true);
  });

  it('persists a hide toggle change with the other preferences', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      catalogStore.getState().setHideFull(true);
    });
    expect(repo.saved).toEqual([
      {
        schemaVersion: 1,
        language: 'th',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
        suggestObjective: 'coverAll',
        suggestPreference: 'balanced',
        catalogHides: { ...NO_HIDES, full: true },
      },
    ]);
  });

  it('does not save for a catalog change that leaves the hides alone', async () => {
    const repo = makeRepo(null);
    renderHook(() => {
      usePrefsPersistence(repo);
    });
    await flush();

    act(() => {
      catalogStore.getState().setText('math');
      catalogStore.getState().toggleDay(1);
    });
    expect(repo.saved).toHaveLength(0);
  });
});
