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

function termLabel(store: ReturnType<typeof createSearchStore>): string {
  const { term } = store.getState();
  return `${term.semester}/${term.year}`;
}

describe('the shared term', () => {
  it('keeps the term when the student switches tabs', () => {
    const store = createSearchStore();
    store.getState().seedTerm({ year: '2569', semester: '1' });
    store.getState().patchTerm({ semester: '2' });
    store.getState().setActiveTab('by_subject_id');
    expect(termLabel(store)).toBe('2/2569');
    store.getState().setActiveTab('by_subject_owner_id');
    expect(termLabel(store)).toBe('2/2569');
  });

  it('leaves the term alone when a tab field changes', () => {
    const store = createSearchStore();
    store.getState().seedTerm({ year: '2569', semester: '3' });
    store.getState().patchClassForm({ faculty: '01' });
    store.getState().patchSubjectIdForm({ subjectId: '90592033' });
    store.getState().patchCategoryForm({ subjectOwner: '32' });
    expect(termLabel(store)).toBe('3/2569');
  });

  it('takes the persisted term on hydrate', () => {
    const store = createSearchStore();
    store.getState().hydrate({
      schemaVersion: 2,
      activeTab: 'by_subject_id',
      term: { year: '2568', semester: '2' },
      byClass: defaultClassForm(),
      bySubjectId: defaultSubjectIdForm(),
      byCategory: defaultCategoryForm(),
    });
    expect(termLabel(store)).toBe('2/2568');
  });
});

describe('the fetched default term', () => {
  it('replaces an untouched fallback', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('2/2569');
    expect(store.getState().defaultTermPending).toBe(false);
  });

  it('is ignored once the student edits a term field', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().patchTerm({ year: '2570' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('1/2570');
  });

  it('survives an edit that leaves the term alone', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().patchClassForm({ faculty: '01' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('2/2569');
  });

  it('is ignored after another source seeds the term', () => {
    const store = createSearchStore();
    store.getState().seedFallbackTerm(fallback);
    store.getState().seedTerm({ year: '2568', semester: '3' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('3/2568');
  });

  it('never applies without a pending fallback', () => {
    const store = createSearchStore();
    store.getState().seedTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('1/2570');
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
    expect(state.resultIntent).toBeNull();
    expect(state.barQuery).toBeNull();
    expect(state.searchFormOpen).toBe(true);
  });

  it('starts a user search in one write that folds the form', () => {
    const store = createSearchStore();
    let writes = 0;
    store.subscribe(() => {
      writes += 1;
    });
    store.getState().startQuery(ownerQuery, 'user');
    const state = store.getState();
    expect(writes).toBe(1);
    expect(state.result).toEqual({ status: 'loading' });
    expect(state.resultQuery).toBe(ownerQuery);
    expect(state.resultIntent).toBe('user');
    expect(state.barQuery).toBe(ownerQuery);
    expect(state.searchFormOpen).toBe(false);
    expect(state.lastSubmitAt).toEqual(expect.any(Number));
  });

  it('leaves the disclosure alone on a background run', () => {
    const store = createSearchStore();
    store.getState().startQuery(ownerQuery, 'user');
    store.getState().setSearchFormOpen(true);
    const { lastSubmitAt } = store.getState();
    const rerun: TeachTableQuery = { ...ownerQuery };
    store.getState().startQuery(rerun, 'background');
    const state = store.getState();
    expect(state.resultQuery).toBe(rerun);
    expect(state.resultIntent).toBe('background');
    expect(state.barQuery).toBe(ownerQuery);
    expect(state.searchFormOpen).toBe(true);
    expect(state.lastSubmitAt).toBe(lastSubmitAt);
  });

  it('leaves the bar alone when a persisted search hydrates', () => {
    const store = createSearchStore();
    store.getState().hydrate({
      schemaVersion: 2,
      activeTab: 'by_subject_owner_id',
      term: { year: '2569', semester: '1' },
      byClass: defaultClassForm(),
      bySubjectId: defaultSubjectIdForm(),
      byCategory: defaultCategoryForm(),
    });
    expect(store.getState().barQuery).toBeNull();
    expect(selectFormOpen(store.getState())).toBe(true);
  });
});
