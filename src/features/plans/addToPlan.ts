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

/** The source query for the search that produced the current catalog, or null when
 * no search has run, stamped on a new entry so revalidation can replay it. */
function currentSourceQuery(): SourceQuery | null {
  const query = searchStore.getState().resultQuery;
  return query === null ? null : toSourceQuery(query);
}

// The catalog only renders once a search returns a result, so a term bearing source
// query is always present when a section can be added; this guards the unreachable
// case rather than stamping a term-less entry that the plan term invariant rejects.
const NO_SEARCH_CONTEXT = { ok: false as const, conflicts: [] };

export function addSectionToPlan(course: Course, section: Section): AddOutcome {
  const sourceQuery = currentSourceQuery();
  if (sourceQuery === null) {
    return NO_SEARCH_CONTEXT;
  }
  return planStore.getState().add(course, section, sourceQuery);
}

/** Remove the listed placed sections and their pairs, add one section and its pair,
 * as one undoable step, stamping the incoming entry with the current source query. */
function commit(
  removeIds: string[],
  course: Course,
  section: Section,
  kind: 'move' | 'swap',
): TransactionOutcome {
  const sourceQuery = currentSourceQuery();
  if (sourceQuery === null) {
    return NO_SEARCH_CONTEXT;
  }
  return planStore
    .getState()
    .apply(removeIds, { course, section, sourceQuery }, kind);
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
