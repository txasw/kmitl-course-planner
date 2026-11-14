// Session scoped catalog filter, sort, card disclosure, and heading collapse
// state. Held in memory like the other panel stores, it survives closing and
// reopening the overlay within a page session. Every update produces a new filter
// object so the shared empty filter is never mutated, and clearing the filters
// leaves the sort as the student chose it. The three hide toggles are also stored
// with the preferences, so they read back through selectHides and restore through
// setHides in one update. The per term shortlist lives here too, apart from the
// filter, and is stored with the preferences as well (ADR-0069).

import { createStore } from 'zustand/vanilla';
import { EMPTY_FILTER, type CatalogFilter } from '@/lib/catalog/filter';
import type { CurriculumProfile } from '@/lib/catalog/curriculumProfile';
import type { DayOfWeek } from '@/lib/domain/types';
import type { CatalogHides } from '@/lib/storage/prefs';
import type { Term } from '@/lib/routing/academicTerms';
import {
  EMPTY_SHORTLIST,
  toggleShortlisted,
  type Shortlist,
} from '@/lib/catalog/shortlist';
import {
  EMPTY_DISCLOSURE,
  withAllCards,
  withChoice,
  withPlacement,
  type CardChoice,
  type CardDisclosure,
  type CardTarget,
} from '@/lib/catalog/cardDisclosure';
import {
  DEFAULT_COURSE_SORT,
  type CourseSortKey,
} from '@/lib/catalog/sortCourses';
import {
  EMPTY_GROUP_COLLAPSE,
  withGroupCollapsed,
  type GroupCollapse,
} from '@/lib/catalog/groupCollapse';

export interface CatalogStore {
  filter: CatalogFilter;
  setText: (text: string) => void;
  toggleDay: (day: DayOfWeek) => void;
  setCredit: (credit: number | null) => void;
  setHideFull: (value: boolean) => void;
  setHideConflicting: (value: boolean) => void;
  setHideUnscheduled: (value: boolean) => void;
  /** Sets the three hide toggles together, as restored from the preferences. */
  setHides: (hides: CatalogHides) => void;
  /** Keep only the sections offered to this curriculum, or null to show every section. */
  setCurriculum: (profile: CurriculumProfile | null) => void;
  /** Keep only the courses on the browsed term's shortlist. */
  setSavedOnly: (value: boolean) => void;
  resetFilter: () => void;
  disclosure: CardDisclosure;
  setCardOpen: (
    queryKey: string | null,
    subjectId: string,
    choice: CardChoice,
  ) => void;
  /** Opens or closes every given card at once, with no transition. */
  setAllCards: (
    queryKey: string | null,
    cards: readonly CardTarget[],
    open: boolean,
  ) => void;
  /** Drops the card choices a plan change has made stale. */
  syncPlacement: (addedIds: ReadonlySet<string>) => void;
  /** The order of the courses inside each heading, kept apart from the filter. */
  sort: CourseSortKey;
  setSort: (sort: CourseSortKey) => void;
  groups: GroupCollapse;
  setGroupCollapsed: (
    queryKey: string | null,
    groupKey: string,
    collapsed: boolean,
  ) => void;
  /** The saved courses per term, which a filter reset leaves alone. */
  shortlist: Shortlist;
  /** Saves the course for the term, or removes it when it is already saved. */
  toggleShortlisted: (term: Term, subjectId: string) => void;
  /** Replaces the whole shortlist, as restored from the preferences. */
  setShortlist: (shortlist: Shortlist) => void;
}

/** The hide toggles of the current filter, in the shape the preferences store. */
export function selectHides(state: Pick<CatalogStore, 'filter'>): CatalogHides {
  return {
    full: state.filter.hideFull,
    conflicting: state.filter.hideConflicting,
    unscheduled: state.filter.hideUnscheduled,
  };
}

/** Whether two hide toggle sets hold the same three values. */
export function sameHides(a: CatalogHides, b: CatalogHides): boolean {
  return (
    a.full === b.full &&
    a.conflicting === b.conflicting &&
    a.unscheduled === b.unscheduled
  );
}

export function createCatalogStore() {
  return createStore<CatalogStore>((set) => ({
    filter: EMPTY_FILTER,
    setText: (text) => {
      set((state) => ({ filter: { ...state.filter, text } }));
    },
    toggleDay: (day) => {
      set((state) => {
        const days = state.filter.days.includes(day)
          ? state.filter.days.filter((current) => current !== day)
          : [...state.filter.days, day];
        return { filter: { ...state.filter, days } };
      });
    },
    setCredit: (credit) => {
      set((state) => ({ filter: { ...state.filter, credit } }));
    },
    setHideFull: (hideFull) => {
      set((state) => ({ filter: { ...state.filter, hideFull } }));
    },
    setHideConflicting: (hideConflicting) => {
      set((state) => ({ filter: { ...state.filter, hideConflicting } }));
    },
    setHideUnscheduled: (hideUnscheduled) => {
      set((state) => ({ filter: { ...state.filter, hideUnscheduled } }));
    },
    setHides: (hides) => {
      set((state) => ({
        filter: {
          ...state.filter,
          hideFull: hides.full,
          hideConflicting: hides.conflicting,
          hideUnscheduled: hides.unscheduled,
        },
      }));
    },
    setCurriculum: (curriculum) => {
      set((state) => ({ filter: { ...state.filter, curriculum } }));
    },
    setSavedOnly: (savedOnly) => {
      set((state) => ({ filter: { ...state.filter, savedOnly } }));
    },
    resetFilter: () => {
      set({ filter: EMPTY_FILTER });
    },
    disclosure: EMPTY_DISCLOSURE,
    setCardOpen: (queryKey, subjectId, choice) => {
      set((state) => ({
        disclosure: withChoice(state.disclosure, queryKey, subjectId, choice),
      }));
    },
    setAllCards: (queryKey, cards, open) => {
      set((state) => ({
        disclosure: withAllCards(state.disclosure, queryKey, cards, open),
      }));
    },
    syncPlacement: (addedIds) => {
      set((state) => ({
        disclosure: withPlacement(state.disclosure, addedIds),
      }));
    },
    sort: DEFAULT_COURSE_SORT,
    setSort: (sort) => {
      set({ sort });
    },
    groups: EMPTY_GROUP_COLLAPSE,
    setGroupCollapsed: (queryKey, groupKey, collapsed) => {
      set((state) => ({
        groups: withGroupCollapsed(state.groups, queryKey, groupKey, collapsed),
      }));
    },
    shortlist: EMPTY_SHORTLIST,
    toggleShortlisted: (term, subjectId) => {
      set((state) => ({
        shortlist: toggleShortlisted(state.shortlist, term, subjectId),
      }));
    },
    setShortlist: (shortlist) => {
      set({ shortlist });
    },
  }));
}

/** The single catalog store instance the catalog UI binds to. */
export const catalogStore = createCatalogStore();
