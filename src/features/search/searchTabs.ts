// The label and icon of each search tab, shared by the tab bar in the form and the
// summary bar that names the tab of the running search, so the two never disagree.

import { GraduationCap, Hash, Layers, type LucideIcon } from 'lucide-react';
import type { SearchTab } from '@/lib/search/formState';

export const TAB_LABEL: Record<
  SearchTab,
  'search.tab.byClass' | 'search.tab.bySubjectId' | 'search.tab.byCategory'
> = {
  by_class: 'search.tab.byClass',
  by_subject_id: 'search.tab.bySubjectId',
  by_subject_owner_id: 'search.tab.byCategory',
};

export const TAB_ICON: Record<SearchTab, LucideIcon> = {
  by_class: GraduationCap,
  by_subject_id: Hash,
  by_subject_owner_id: Layers,
};
