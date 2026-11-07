import { describe, expect, it } from 'vitest';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Term } from '@/lib/routing/academicTerms';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import type { SearchPrefill } from '@/lib/search/queryForms';
import type {
  SearchState as PersistedSearchState,
  SearchStateRepository,
} from '@/lib/storage/lastSearch';
import {
  createSearchStore,
  selectBarVisible,
  selectFormOpen,
  selectTermSettled,
} from './searchStore';

const fallback: Term = { year: '2570', semester: '1' };
const fetched: Term = { year: '2569', semester: '2' };

// A search run under the fallback term, before the fetched default arrives.
const fallbackQuery: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: fallback.year,
  selected_semester: fallback.semester,
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '90592033',
};

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

  it('seeds the persisted forms and a route term in one write', () => {
    const store = createSearchStore();
    let writes = 0;
    store.subscribe(() => {
      writes += 1;
    });
    store.getState().seedSearch(
      {
        schemaVersion: 2,
        activeTab: 'by_subject_id',
        term: { year: '2569', semester: '1' },
        byClass: defaultClassForm(),
        bySubjectId: { subjectId: '90592033' },
        byCategory: defaultCategoryForm(),
      },
      { term: { year: '2568', semester: '2' }, source: 'route' },
    );
    expect(writes).toBe(1);
    expect(store.getState().activeTab).toBe('by_subject_id');
    expect(store.getState().bySubjectId).toEqual({ subjectId: '90592033' });
    expect(termLabel(store)).toBe('2/2568');
    expect(store.getState().defaultTermPending).toBe(false);
  });
});

describe('the fetched default term', () => {
  it('replaces an untouched fallback', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('2/2569');
    expect(store.getState().defaultTermPending).toBe(false);
  });

  it('is ignored once the student edits a term field', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().patchTerm({ year: '2570' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('1/2570');
  });

  it('survives an edit that leaves the term alone', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().patchClassForm({ faculty: '01' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('2/2569');
  });

  it('is ignored after another source seeds the term', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().seedTerm({ year: '2568', semester: '3' });
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('3/2568');
  });

  it('is ignored after a user search runs under the fallback', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().startQuery(fallbackQuery, 'user');
    store.getState().applyDefaultTerm(fetched);
    // The form keeps the term the summary bar names.
    expect(termLabel(store)).toBe('1/2570');
    expect(store.getState().barQuery?.selected_semester).toBe('1');
    expect(store.getState().barQuery?.selected_year).toBe('2570');
  });

  it('still applies after a background run under the fallback', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().startQuery(fallbackQuery, 'background');
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('2/2569');
  });

  it('never applies without a pending fallback', () => {
    const store = createSearchStore();
    store.getState().seedTerm(fallback);
    store.getState().applyDefaultTerm(fetched);
    expect(termLabel(store)).toBe('1/2570');
  });
});

describe('the settled term', () => {
  it('is not settled before any source seeds the term', () => {
    expect(selectTermSettled(createSearchStore().getState())).toBe(false);
  });

  it('is not settled while the fallback awaits the fetched default', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    expect(selectTermSettled(store.getState())).toBe(false);
  });

  it('settles once the default applies or another source seeds the term', () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    store.getState().applyDefaultTerm(fetched);
    expect(selectTermSettled(store.getState())).toBe(true);
    const seeded = createSearchStore();
    seeded.getState().seedTerm(fetched);
    expect(selectTermSettled(seeded.getState())).toBe(true);
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

describe('clearing the active form', () => {
  it('resets only the active tab and leaves the bar and result alone', () => {
    const store = createSearchStore();
    store.getState().seedTerm(fetched);
    store.getState().setActiveTab('by_subject_owner_id');
    store.getState().patchCategoryForm({ faculty: '01', subjectOwner: '32' });
    store.getState().patchClassForm({ faculty: '01' });
    store.getState().startQuery(ownerQuery, 'user');
    store.getState().setSearchFormOpen(true);

    store.getState().clearActiveForm();
    const state = store.getState();
    expect(state.byCategory).toEqual(defaultCategoryForm());
    expect(state.term).toEqual(fetched);
    expect(state.byClass.faculty).toBe('01');
    expect(state.barQuery).toBe(ownerQuery);
    expect(state.resultQuery).toBe(ownerQuery);
    expect(state.result).toEqual({ status: 'loading' });
    expect(state.searchFormOpen).toBe(true);
  });
});

describe('applying a route prefill', () => {
  const prefill: SearchPrefill = {
    tab: 'by_subject_owner_id',
    term: { year: '2569', semester: '1' },
    form: { faculty: '01', subjectOwner: '46' },
  };

  function persisted(): PersistedSearchState {
    return {
      schemaVersion: 2,
      activeTab: 'by_class',
      term: { year: '2568', semester: '2' },
      byClass: {
        faculty: '01',
        department: '08',
        curriculum: '08',
        classYear: '4',
      },
      bySubjectId: { subjectId: '90592033' },
      byCategory: { faculty: '05', subjectOwner: '6' },
    };
  }

  function repoLoading(
    load: () => Promise<PersistedSearchState | null>,
  ): Pick<SearchStateRepository, 'load'> {
    return { load };
  }

  it('claims the initialization once and reads a rejected load as none', async () => {
    const store = createSearchStore();
    const load = store
      .getState()
      .claimInitialization(
        repoLoading(() => Promise.reject(new Error('storage unavailable'))),
      );
    expect(
      store
        .getState()
        .claimInitialization(repoLoading(() => Promise.resolve(persisted()))),
    ).toBeNull();
    expect(await load).toBeNull();
  });

  it('claims the initialization before the load settles', () => {
    const store = createSearchStore();
    void store.getState().applyRoutePrefill(
      prefill,
      repoLoading(() => new Promise(() => undefined)),
    );
    expect(store.getState().hasInitialized).toBe(true);
  });

  it('lays the prefill over the persisted search', async () => {
    const store = createSearchStore();
    await store.getState().applyRoutePrefill(
      prefill,
      repoLoading(() => Promise.resolve(persisted())),
    );
    const state = store.getState();
    expect(state.activeTab).toBe('by_subject_owner_id');
    expect(state.term).toEqual(prefill.term);
    expect(state.byCategory).toEqual(prefill.form);
    expect(state.byClass).toEqual(persisted().byClass);
    expect(state.bySubjectId).toEqual(persisted().bySubjectId);
  });

  it('ends a pending default so the fetched term cannot replace it', async () => {
    const store = createSearchStore();
    store.getState().seedSearch(null, { term: fallback, source: 'fallback' });
    await store.getState().applyRoutePrefill(
      prefill,
      repoLoading(() => Promise.resolve(null)),
    );
    store.getState().applyDefaultTerm(fetched);
    expect(store.getState().term).toEqual(prefill.term);
  });

  it('still applies the prefill when the load is rejected', async () => {
    const store = createSearchStore();
    await store.getState().applyRoutePrefill(
      prefill,
      repoLoading(() => Promise.reject(new Error('storage unavailable'))),
    );
    const state = store.getState();
    expect(state.activeTab).toBe('by_subject_owner_id');
    expect(state.byCategory).toEqual(prefill.form);
    expect(state.byClass).toEqual(defaultClassForm());
  });

  it('keeps in session edits once the search is initialized', async () => {
    const store = createSearchStore();
    store.getState().setInitialized(true);
    store.getState().patchSubjectIdForm({ subjectId: '01006001' });
    let loads = 0;
    await store.getState().applyRoutePrefill(
      prefill,
      repoLoading(() => {
        loads += 1;
        return Promise.resolve(persisted());
      }),
    );
    expect(loads).toBe(0);
    expect(store.getState().bySubjectId).toEqual({ subjectId: '01006001' });
    expect(store.getState().byCategory).toEqual(prefill.form);
  });
});
