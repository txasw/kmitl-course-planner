// Session scoped catalog filter state. Held in memory like the other panel
// stores, it survives closing and reopening the overlay within a page session.
// Every update produces a new filter object so the shared empty filter is never
// mutated.

import { createStore } from 'zustand/vanilla';
import { EMPTY_FILTER, type CatalogFilter } from '@/lib/catalog/filter';
import type { DayOfWeek } from '@/lib/domain/types';

export interface CatalogStore {
  filter: CatalogFilter;
  setText: (text: string) => void;
  toggleDay: (day: DayOfWeek) => void;
  setCredit: (credit: number | null) => void;
  setHideFull: (value: boolean) => void;
  setHideConflicting: (value: boolean) => void;
  setHideUnscheduled: (value: boolean) => void;
  resetFilter: () => void;
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
    resetFilter: () => {
      set({ filter: EMPTY_FILTER });
    },
  }));
}

/** The single catalog store instance the catalog UI binds to. */
export const catalogStore = createCatalogStore();
