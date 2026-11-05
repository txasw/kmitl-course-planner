import { describe, expect, it } from 'vitest';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Term } from '@/lib/routing/academicTerms';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import {
  createSearchStore,
  selectBarVisible,
  selectFormOpen,
} from './searchStore';

const fallback: Term = { year: '2570', semester: '1' };
const fetched: Term = { year: '2569', semester: '2' };

function yearsAndSemesters(store: ReturnType<typeof createSearchStore>) {
  const { byClass, bySubjectId, byCategory } = store.getState();
  return [byClass, bySubjectId, byCategory].map(
    (form) => `${form.semester}/${form.year}`,
  );
}

describe('the fetched default term', () => {
  it('replaces an untouched fallback in every tab', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['2/2569', '2/2569', '2/2569']);
    expect(store.getState().defaultTermPending).toBe(false);
  });

  it('is ignored once the student edits a term field', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().patchCategoryForm({ year: '2570' });
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['1/2570', '1/2570', '1/2570']);
  });

  it('survives an edit that leaves the term alone', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().patchClassForm({ faculty: '01' });
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['2/2569', '2/2569', '2/2569']);
  });

  it('is ignored after another source seeds the term', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().seedTerm({ year: '2568', semester: '3' });
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['3/2568', '3/2568', '3/2568']);
  });

  it('never applies without a pending fallback', () => {
    const store = createSearchStore();
    store.getState().seedTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(yearsAndSemesters(store)).toEqual(['1/2570', '1/2570', '1/2570']);
  });
});

const ownerQuery: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  selected_subject_owner_id: '32',
};

describe('the search disclosure', () => {
  it('starts with no bar and the form open', () => {
    const state = createSearchStore().getState();
    expect(state.barQuery).toBeNull();
    expect(state.searchFormOpen).toBe(true);
    expect(state.lastSubmitAt).toBeNull();
    expect(selectBarVisible(state)).toBe(false);
    expect(selectFormOpen(state)).toBe(true);
  });

  it('shows the form without a bar even when it was closed', () => {
    const store = createSearchStore();
    store.getState().setSearchFormOpen(false);
    expect(selectFormOpen(store.getState())).toBe(true);
    store.setState({ barQuery: ownerQuery });
    expect(selectFormOpen(store.getState())).toBe(false);
    store.getState().setSearchFormOpen(true);
    expect(selectFormOpen(store.getState())).toBe(true);
  });

  it('clears the bar and opens the form on cancel', () => {
    const store = createSearchStore();
    store.setState({
      result: { status: 'loading' },
      resultQuery: ownerQuery,
      barQuery: ownerQuery,
      searchFormOpen: false,
    });
    store.getState().cancelSearch();
    const state = store.getState();
    expect(state.result).toEqual({ status: 'idle' });
    expect(state.resultQuery).toBeNull();
    expect(state.barQuery).toBeNull();
    expect(state.searchFormOpen).toBe(true);
  });

  it('leaves the bar alone when a persisted search hydrates', () => {
    const store = createSearchStore();
    const term = { year: '2569', semester: '1' } as const;
    store.getState().hydrate({
      schemaVersion: 1,
      activeTab: 'by_subject_owner_id',
      byClass: defaultClassForm(term),
      bySubjectId: defaultSubjectIdForm(term),
      byCategory: defaultCategoryForm(term),
    });
    expect(store.getState().barQuery).toBeNull();
    expect(selectFormOpen(store.getState())).toBe(true);
  });
});
