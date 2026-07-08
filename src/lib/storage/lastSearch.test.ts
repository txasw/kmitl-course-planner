import { describe, expect, it } from 'vitest';
import type { Term } from '../routing/academicTerms';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '../search/formState';
import type { StorageAdapter } from './repo';
import { SEARCH_KEY } from './keys';
import { createSearchStateRepository, type SearchState } from './lastSearch';

function memoryAdapter(): StorageAdapter & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: (key) => Promise.resolve(map.get(key)),
    set: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
  };
}

const term: Term = { year: '2569', semester: '1' };

function sampleState(): SearchState {
  return {
    schemaVersion: 1,
    activeTab: 'by_subject_owner_id',
    byClass: { ...defaultClassForm(term), faculty: '01' },
    bySubjectId: defaultSubjectIdForm(term),
    byCategory: {
      ...defaultCategoryForm(term),
      faculty: '01',
      subjectOwner: '32',
    },
  };
}

describe('createSearchStateRepository', () => {
  it('round trips a saved state', async () => {
    const adapter = memoryAdapter();
    const repo = createSearchStateRepository(adapter);
    const state = sampleState();
    await repo.save(state);
    expect(adapter.map.has(SEARCH_KEY)).toBe(true);
    expect(await repo.load()).toEqual(state);
  });

  it('returns null when nothing is stored', async () => {
    const repo = createSearchStateRepository(memoryAdapter());
    expect(await repo.load()).toBeNull();
  });

  it('returns null for a corrupt blob rather than throwing', async () => {
    const adapter = memoryAdapter();
    adapter.map.set(SEARCH_KEY, { schemaVersion: 2, nonsense: true });
    const repo = createSearchStateRepository(adapter);
    expect(await repo.load()).toBeNull();
  });

  it('loads an old by_subject_id blob by dropping its extra fields', async () => {
    // Before the search-all fix, by_subject_id carried faculty, department,
    // curriculum, and classYear. An old blob must still load, not reset.
    const adapter = memoryAdapter();
    const state = sampleState();
    adapter.map.set(SEARCH_KEY, {
      ...state,
      bySubjectId: {
        ...state.bySubjectId,
        faculty: '01',
        department: '05',
        curriculum: '137',
        classYear: '1',
      },
    });
    const repo = createSearchStateRepository(adapter);
    expect(await repo.load()).toEqual(state);
  });
});
