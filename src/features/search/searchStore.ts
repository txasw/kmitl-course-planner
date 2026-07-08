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

export interface SearchStore {
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
  setActiveTab: (tab: SearchTab) => void;
  patchClassForm: (patch: Partial<ClassForm>) => void;
  patchSubjectIdForm: (patch: Partial<SubjectIdForm>) => void;
  patchCategoryForm: (patch: Partial<CategoryForm>) => void;
  seedTerm: (term: Term) => void;
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
    setActiveTab: (tab) => {
      set({ activeTab: tab });
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
    seedTerm: (term) => {
      set((state) => ({
        byClass: { ...state.byClass, year: term.year, semester: term.semester },
        bySubjectId: {
          ...state.bySubjectId,
          year: term.year,
          semester: term.semester,
        },
        byCategory: {
          ...state.byCategory,
          year: term.year,
          semester: term.semester,
        },
      }));
    },
    hydrate: (persisted) => {
      set({
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
