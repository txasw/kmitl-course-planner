// Add a section to the plan, stamping the entry's source query from the search
// that produced the current catalog so revalidation can later replay it. Both the
// catalog add button and the drag commit go through here, so the source query
// logic lives in one place.

import type { Course, Section } from '@/lib/domain/types';
import type { SourceQuery } from '@/lib/domain/plan';
import type { AddOutcome, TransactionOutcome } from '@/lib/planner/transaction';
import { toSourceQuery } from '@/lib/planner/sourceQuery';
import { searchStore } from '@/features/search/searchStore';
import { planStore } from './planStore';

const FALLBACK_SOURCE_QUERY: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: {},
};

/** The source query for the search that produced the current catalog, stamped on a
 * new entry so revalidation can replay it. */
function currentSourceQuery(): SourceQuery {
  const query = searchStore.getState().resultQuery;
  return query === null ? FALLBACK_SOURCE_QUERY : toSourceQuery(query);
}

export function addSectionToPlan(course: Course, section: Section): AddOutcome {
  return planStore.getState().add(course, section, currentSourceQuery());
}

/** Remove the listed placed sections and their pairs, add one section and its pair,
 * as one undoable step, stamping the incoming entry with the current source query. */
function commit(
  removeIds: string[],
  course: Course,
  section: Section,
  kind: 'move' | 'swap',
): TransactionOutcome {
  return planStore
    .getState()
    .apply(
      removeIds,
      { course, section, sourceQuery: currentSourceQuery() },
      kind,
    );
}

/**
 * Move a placed section to another section of the same subject: remove the origin
 * and its pair, add the target and its pair. Returns the outcome so a residual
 * conflict can be surfaced.
 */
export function moveSectionInPlan(
  fromTeachTableId: string,
  course: Course,
  toSection: Section,
): TransactionOutcome {
  return commit([fromTeachTableId], course, toSection, 'move');
}

/**
 * Swap a blocking section for an incoming one: remove the blocker and its pair (and,
 * for a block move, the dragged origin too), add the incoming section and its pair.
 * When removing the blocker still leaves a conflict, nothing changes and the residual
 * conflicts are returned.
 */
export function swapSectionInPlan(
  removeIds: string[],
  course: Course,
  incoming: Section,
): TransactionOutcome {
  return commit(removeIds, course, incoming, 'swap');
}
