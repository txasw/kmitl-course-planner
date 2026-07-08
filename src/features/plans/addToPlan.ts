// Add a section to the plan, stamping the entry's source query from the search
// that produced the current catalog so revalidation can later replay it. Both the
// catalog add button and the drag commit go through here, so the source query
// logic lives in one place.

import type { Course, Section } from '@/lib/domain/types';
import type { SourceQuery } from '@/lib/domain/plan';
import type { AddOutcome } from '@/lib/planner/transaction';
import { toSourceQuery } from '@/lib/planner/sourceQuery';
import { searchStore } from '@/features/search/searchStore';
import { planStore } from './planStore';

const FALLBACK_SOURCE_QUERY: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: {},
};

export function addSectionToPlan(course: Course, section: Section): AddOutcome {
  const query = searchStore.getState().resultQuery;
  const sourceQuery =
    query === null ? FALLBACK_SOURCE_QUERY : toSourceQuery(query);
  return planStore.getState().add(course, section, sourceQuery);
}
