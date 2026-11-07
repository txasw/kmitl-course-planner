// Session scoped search state: the active tab, the one term every tab shares, the
// three tab forms, the fetched reference lists, and the latest query result. Like
// the ui store it is held in memory and carries no persistence, so it survives
// closing and reopening the overlay within a page session while the panel that
// submits a search writes the last search to storage. The store only merges
// patches; cascade resets when a faculty or department changes are applied by the
// form handlers, keeping the store dumb and testable through getState. The search
// disclosure is session state too: barQuery names the search the summary bar
// describes, and searchFormOpen says whether the student has opened the form under
// that bar. Without a bar the form is always shown, so the form is open when either
// holds.

import { createStore } from 'zustand/vanilla';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type {
  RawCurriculum,
  RawDepartment,
  RawFaculty,
  RawSubjectOwner,
} from '@/lib/domain/schemas';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { Term } from '@/lib/routing/academicTerms';
import {
  type CategoryForm,
  type ClassForm,
  type SearchTab,
  type SubjectIdForm,
  clearTabForm,
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import { applyPrefillForms, type SearchPrefill } from '@/lib/search/queryForms';
import type {
  SearchState as PersistedSearchState,
  SearchStateRepository,
} from '@/lib/storage/lastSearch';
import type { AsyncState } from '@/lib/utils/async';

const NEUTRAL_TERM: Term = { year: '', semester: '1' };

/**
 * Who started a query. A user search folds the form into the bar and stamps the
 * submit; a background run (retry, refresh) replaces the result and leaves the
 * disclosure as the student set it.
 */
export type QueryIntent = 'user' | 'background';

export interface SearchStore {
  /**
   * Whether the term has been seeded, the persisted search hydrated, or a route
   * prefill applied for this page session. The overlay unmounts the form on close
   * and remounts it on open, so this guards the one time seed from re running and
   * clobbering in session edits. It resets only on a full page reload.
   */
  hasInitialized: boolean;
  /**
   * Whether the term in the forms is the local fallback seeded while the current
   * registration term is still being fetched. Any other term write clears it, and so
   * does a user search, which runs under the term shown and so chooses it. The fetched
   * default therefore replaces only a term nothing else has set or searched.
   */
  defaultTermPending: boolean;
  activeTab: SearchTab;
  /** The year and semester every tab searches, so a tab switch keeps the term. */
  term: Term;
  byClass: ClassForm;
  bySubjectId: SubjectIdForm;
  byCategory: CategoryForm;
  faculties: AsyncState<RawFaculty[]>;
  departments: AsyncState<RawDepartment[]>;
  curricula: AsyncState<RawCurriculum[]>;
  subjectOwners: AsyncState<RawSubjectOwner[]>;
  result: AsyncState<NormalizedCatalog>;
  resultQuery: TeachTableQuery | null;
  /**
   * Who started the query behind the current result, written with the query in one
   * write, so a settle can tell a user search, which the status announcer speaks, from
   * a background run such as a refresh, which it does not. Null while no query has run.
   */
  resultIntent: QueryIntent | null;
  /** The query the summary bar describes, or null while no user search has run. */
  barQuery: TeachTableQuery | null;
  /** Whether the form is open under the bar; ignored while there is no bar. */
  searchFormOpen: boolean;
  /** When the latest user search was accepted, so the results can guard input. */
  lastSubmitAt: number | null;
  setInitialized: (value: boolean) => void;
  /**
   * Claim the one time initialization and start loading the persisted search, or
   * return null when this page session already claimed it. The claim is synchronous,
   * so a rapid reopen cannot start a second load. A rejected load resolves to null.
   */
  claimInitialization: (
    repo: Pick<SearchStateRepository, 'load'>,
  ) => Promise<PersistedSearchState | null> | null;
  setActiveTab: (tab: SearchTab) => void;
  /** A student edit of the year or semester, which ends any pending default. */
  patchTerm: (patch: Partial<Term>) => void;
  patchClassForm: (patch: Partial<ClassForm>) => void;
  patchSubjectIdForm: (patch: Partial<SubjectIdForm>) => void;
  patchCategoryForm: (patch: Partial<CategoryForm>) => void;
  /**
   * Reset the active tab's fields to their defaults, keeping the term. The bar and the
   * result stay, since they describe the search that ran, not the form being edited.
   */
  clearActiveForm: () => void;
  seedTerm: (term: Term) => void;
  /** Seed the fallback term and mark it replaceable by the fetched default. */
  seedFallbackTerm: (term: Term) => void;
  /** Apply the fetched default term, only while the fallback is still pending. */
  applyDefaultTerm: (term: Term) => void;
  hydrate: (state: PersistedSearchState) => void;
  /**
   * Open the search on a prefill read from a host result route. On the first run of
   * the page session it claims the one time initialization synchronously, so the
   * init hook never runs over the prefill, and hydrates the persisted search first so
   * the other tabs keep their last search; a failed load still applies the prefill.
   * Once initialized it waits for an initialization still in flight and then lays the
   * prefill over the in session forms. The caller may submit once the returned
   * promise resolves.
   */
  applyRoutePrefill: (
    prefill: SearchPrefill,
    repo: Pick<SearchStateRepository, 'load'>,
  ) => Promise<void>;
  setFaculties: (state: AsyncState<RawFaculty[]>) => void;
  setDepartments: (state: AsyncState<RawDepartment[]>) => void;
  setCurricula: (state: AsyncState<RawCurriculum[]>) => void;
  setSubjectOwners: (state: AsyncState<RawSubjectOwner[]>) => void;
  setResult: (
    result: AsyncState<NormalizedCatalog>,
    query: TeachTableQuery | null,
  ) => void;
  /**
   * Mark a query as loading in one write. The stored resultQuery and barQuery are the
   * very object sent to the worker, because the stale response guard compares by
   * reference.
   */
  startQuery: (query: TeachTableQuery, intent: QueryIntent) => void;
  setSearchFormOpen: (open: boolean) => void;
  /** Drop the running search and its bar, returning to the open form. */
  cancelSearch: () => void;
}

// A rejected load reads as no persisted search, as a corrupt one already does.
async function loadPersisted(
  repo: Pick<SearchStateRepository, 'load'>,
): Promise<PersistedSearchState | null> {
  try {
    return await repo.load();
  } catch {
    return null;
  }
}

/** The state with a prefill's tab, term, and form laid over it, ending any default. */
function withPrefill(state: SearchStore, prefill: SearchPrefill) {
  return {
    ...applyPrefillForms(prefill, state),
    activeTab: prefill.tab,
    term: prefill.term,
    defaultTermPending: false,
  };
}

/**
 * Whether the term is final for now: seeded from some source, with no fetched default
 * still able to replace it. Before the first seed the year is empty.
 */
export function selectTermSettled(state: SearchStore): boolean {
  return state.term.year !== '' && !state.defaultTermPending;
}

/** Whether the summary bar exists, which is whenever a user search has run. */
export function selectBarVisible(state: SearchStore): boolean {
  return state.barQuery !== null;
}

/** Whether the search form shows: always without a bar, otherwise as toggled. */
export function selectFormOpen(state: SearchStore): boolean {
  return state.searchFormOpen || state.barQuery === null;
}

export function createSearchStore() {
  // The load the claimed initialization started. A prefill that arrives while it is in
  // flight awaits it, and since the init hook subscribed to it first, the hook's
  // hydrate and term seed settle before the prefill lands rather than over it.
  let initialLoad: Promise<PersistedSearchState | null> = Promise.resolve(null);
  return createStore<SearchStore>((set, get) => ({
    hasInitialized: false,
    defaultTermPending: false,
    activeTab: 'by_class',
    term: NEUTRAL_TERM,
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
    faculties: { status: 'idle' },
    departments: { status: 'idle' },
    curricula: { status: 'idle' },
    subjectOwners: { status: 'idle' },
    result: { status: 'idle' },
    resultQuery: null,
    resultIntent: null,
    barQuery: null,
    searchFormOpen: true,
    lastSubmitAt: null,
    setInitialized: (value) => {
      set({ hasInitialized: value });
    },
    claimInitialization: (repo) => {
      if (get().hasInitialized) {
        return null;
      }
      set({ hasInitialized: true });
      initialLoad = loadPersisted(repo);
      return initialLoad;
    },
    setActiveTab: (tab) => {
      set({ activeTab: tab });
    },
    patchTerm: (patch) => {
      set((state) => ({
        term: { ...state.term, ...patch },
        defaultTermPending: false,
      }));
    },
    patchClassForm: (patch) => {
      set((state) => ({ byClass: { ...state.byClass, ...patch } }));
    },
    patchSubjectIdForm: (patch) => {
      set((state) => ({ bySubjectId: { ...state.bySubjectId, ...patch } }));
    },
    patchCategoryForm: (patch) => {
      set((state) => ({ byCategory: { ...state.byCategory, ...patch } }));
    },
    clearActiveForm: () => {
      set((state) => clearTabForm(state.activeTab, state));
    },
    seedTerm: (term) => {
      set({ term, defaultTermPending: false });
    },
    seedFallbackTerm: (term) => {
      set({ term, defaultTermPending: true });
    },
    applyDefaultTerm: (term) => {
      set((state) =>
        state.defaultTermPending ? { term, defaultTermPending: false } : {},
      );
    },
    hydrate: (persisted) => {
      set({
        defaultTermPending: false,
        activeTab: persisted.activeTab,
        term: persisted.term,
        byClass: persisted.byClass,
        bySubjectId: persisted.bySubjectId,
        byCategory: persisted.byCategory,
      });
    },
    applyRoutePrefill: async (prefill, repo) => {
      const load = get().claimInitialization(repo);
      if (load === null) {
        await initialLoad;
      } else {
        const persisted = await load;
        if (persisted !== null) {
          get().hydrate(persisted);
        }
      }
      set((state) => withPrefill(state, prefill));
    },
    setFaculties: (faculties) => {
      set({ faculties });
    },
    setDepartments: (departments) => {
      set({ departments });
    },
    setCurricula: (curricula) => {
      set({ curricula });
    },
    setSubjectOwners: (subjectOwners) => {
      set({ subjectOwners });
    },
    setResult: (result, query) => {
      set({ result, resultQuery: query });
    },
    startQuery: (query, intent) => {
      set(
        intent === 'user'
          ? {
              result: { status: 'loading' },
              resultQuery: query,
              resultIntent: intent,
              barQuery: query,
              searchFormOpen: false,
              lastSubmitAt: Date.now(),
              // A late default must not move the form off the term the bar names.
              defaultTermPending: false,
            }
          : {
              result: { status: 'loading' },
              resultQuery: query,
              resultIntent: intent,
            },
      );
    },
    setSearchFormOpen: (open) => {
      set({ searchFormOpen: open });
    },
    cancelSearch: () => {
      set({
        result: { status: 'idle' },
        resultQuery: null,
        resultIntent: null,
        barQuery: null,
        searchFormOpen: true,
      });
    },
  }));
}

/** The single store instance the search UI binds to. */
export const searchStore = createSearchStore();
