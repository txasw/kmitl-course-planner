// Session scoped search state: the active tab, the three tab forms, the fetched
// reference lists, and the latest query result. Like the ui store it is held in
// memory and carries no persistence, so it survives closing and reopening the
// overlay within a page session while the panel that submits a search writes the
// last search to storage. The store only merges patches; cascade resets when a
// faculty or department changes are applied by the form handlers, keeping the
// store dumb and testable through getState.

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
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import type { SearchState as PersistedSearchState } from '@/lib/storage/lastSearch';
import type { AsyncState } from '@/lib/utils/async';

const NEUTRAL_TERM: Term = { year: '', semester: '1' };

type TermForms = Pick<SearchStore, 'byClass' | 'bySubjectId' | 'byCategory'>;

/** Write one term into all three tab forms. */
function withTerm(state: TermForms, term: Term): TermForms {
  const patch = { year: term.year, semester: term.semester };
  return {
    byClass: { ...state.byClass, ...patch },
    bySubjectId: { ...state.bySubjectId, ...patch },
    byCategory: { ...state.byCategory, ...patch },
  };
}

/** A form patch that writes the year or semester is a term edit. */
function touchesTerm(patch: { year?: string; semester?: string }): boolean {
  return patch.year !== undefined || patch.semester !== undefined;
}

export interface SearchStore {
  /**
   * Whether the term has been seeded or the persisted search hydrated for this
   * page session. The overlay unmounts the form on close and remounts it on
   * open, so this guards the one time seed from re running and clobbering in
   * session edits. It resets only on a full page reload.
   */
  hasInitialized: boolean;
  /**
   * Whether the term in the forms is the local fallback seeded while the current
   * registration term is still being fetched. Any other term write clears it, so the
   * fetched default replaces only a term nothing else has set.
   */
  defaultTermPending: boolean;
  activeTab: SearchTab;
  byClass: ClassForm;
  bySubjectId: SubjectIdForm;
  byCategory: CategoryForm;
  faculties: AsyncState<RawFaculty[]>;
  departments: AsyncState<RawDepartment[]>;
  curricula: AsyncState<RawCurriculum[]>;
  subjectOwners: AsyncState<RawSubjectOwner[]>;
  result: AsyncState<NormalizedCatalog>;
  resultQuery: TeachTableQuery | null;
  setInitialized: (value: boolean) => void;
  setActiveTab: (tab: SearchTab) => void;
  patchClassForm: (patch: Partial<ClassForm>) => void;
  patchSubjectIdForm: (patch: Partial<SubjectIdForm>) => void;
  patchCategoryForm: (patch: Partial<CategoryForm>) => void;
  seedTerm: (term: Term) => void;
  /** Seed the fallback term and mark it replaceable by the fetched default. */
  seedFallbackTerm: (term: Term) => void;
  /** Apply the fetched default term, only while the fallback is still pending. */
  applyDefaultTerm: (term: Term) => void;
  hydrate: (state: PersistedSearchState) => void;
  setFaculties: (state: AsyncState<RawFaculty[]>) => void;
  setDepartments: (state: AsyncState<RawDepartment[]>) => void;
  setCurricula: (state: AsyncState<RawCurriculum[]>) => void;
  setSubjectOwners: (state: AsyncState<RawSubjectOwner[]>) => void;
  setResult: (
    result: AsyncState<NormalizedCatalog>,
    query: TeachTableQuery | null,
  ) => void;
}

export function createSearchStore() {
  return createStore<SearchStore>((set) => ({
    hasInitialized: false,
    defaultTermPending: false,
    activeTab: 'by_class',
    byClass: defaultClassForm(NEUTRAL_TERM),
    bySubjectId: defaultSubjectIdForm(NEUTRAL_TERM),
    byCategory: defaultCategoryForm(NEUTRAL_TERM),
    faculties: { status: 'idle' },
    departments: { status: 'idle' },
    curricula: { status: 'idle' },
    subjectOwners: { status: 'idle' },
    result: { status: 'idle' },
    resultQuery: null,
    setInitialized: (value) => {
      set({ hasInitialized: value });
    },
    setActiveTab: (tab) => {
      set({ activeTab: tab });
    },
    patchClassForm: (patch) => {
      set((state) => ({
        byClass: { ...state.byClass, ...patch },
        ...(touchesTerm(patch) ? { defaultTermPending: false } : {}),
      }));
    },
    patchSubjectIdForm: (patch) => {
      set((state) => ({
        bySubjectId: { ...state.bySubjectId, ...patch },
        ...(touchesTerm(patch) ? { defaultTermPending: false } : {}),
      }));
    },
    patchCategoryForm: (patch) => {
      set((state) => ({
        byCategory: { ...state.byCategory, ...patch },
        ...(touchesTerm(patch) ? { defaultTermPending: false } : {}),
      }));
    },
    seedTerm: (term) => {
      set((state) => ({ ...withTerm(state, term), defaultTermPending: false }));
    },
    seedFallbackTerm: (term) => {
      set((state) => ({ ...withTerm(state, term), defaultTermPending: true }));
    },
    applyDefaultTerm: (term) => {
      set((state) =>
        state.defaultTermPending
          ? { ...withTerm(state, term), defaultTermPending: false }
          : {},
      );
    },
    hydrate: (persisted) => {
      set({
        defaultTermPending: false,
        activeTab: persisted.activeTab,
        byClass: persisted.byClass,
        bySubjectId: persisted.bySubjectId,
        byCategory: persisted.byCategory,
      });
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
  }));
}

/** The single store instance the search UI binds to. */
export const searchStore = createSearchStore();
