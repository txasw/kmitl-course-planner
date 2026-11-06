import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { ReferenceLists } from '@/lib/reference/filters';
import { searchStore } from './searchStore';

/**
 * The four reference lists the search form loaded, for surfaces outside the form
 * that name a faculty, department, or curriculum. The object keeps its identity
 * until a list changes, so a memoized name lookup does not rerun on every render.
 */
export function useReferenceLists(): ReferenceLists {
  const faculties = useStore(searchStore, (state) => state.faculties);
  const departments = useStore(searchStore, (state) => state.departments);
  const curricula = useStore(searchStore, (state) => state.curricula);
  const subjectOwners = useStore(searchStore, (state) => state.subjectOwners);
  return useMemo(
    () => ({ faculties, departments, curricula, subjectOwners }),
    [faculties, departments, curricula, subjectOwners],
  );
}
