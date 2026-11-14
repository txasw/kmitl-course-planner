// The catalog sort control beside the filters: a select only combobox over the sort
// orders. Sorting is not a filter, so it adds no chip and clearing the filters keeps it.

import { useStore } from 'zustand';
import {
  COURSE_SORT_KEYS,
  type CourseSortKey,
} from '@/lib/catalog/sortCourses';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { Combobox } from '@/features/search/Combobox';
import { catalogStore } from './catalogStore';

const SORT_LABEL_KEYS: Record<CourseSortKey, TranslationKey> = {
  subjectId: 'catalog.sort.subjectId',
  openSeats: 'catalog.sort.openSeats',
  earliestStart: 'catalog.sort.earliestStart',
};

function isSortKey(value: string): value is CourseSortKey {
  return COURSE_SORT_KEYS.some((key) => key === value);
}

export function SortControl({ t }: { t: Translate }) {
  const sort = useStore(catalogStore, (state) => state.sort);
  return (
    <Combobox
      inline
      label={t('catalog.sort.label')}
      value={sort}
      placeholder={t(SORT_LABEL_KEYS[sort])}
      disabled={false}
      searchable={false}
      options={COURSE_SORT_KEYS.map((key) => ({
        value: key,
        label: t(SORT_LABEL_KEYS[key]),
      }))}
      onChange={(value) => {
        if (isSortKey(value)) catalogStore.getState().setSort(value);
      }}
    />
  );
}
