// Add a section to the plan, stamping the entry's source query from the search
// that produced the current catalog so revalidation can later replay it. Both the
// catalog add button and the drag commit go through here, so the source query
// logic lives in one place.

import type { Course, Section } from '@/lib/domain/types';
import type { SourceQuery } from '@/lib/domain/plan';
import type { AddOutcome, TransactionOutcome } from '@/lib/planner/transaction';
import { placedSections } from '@/lib/planner/transaction';
import { toSourceQuery } from '@/lib/planner/sourceQuery';
import { addedExamWarnings } from '@/lib/planner/examOverlap';
import { searchStore } from '@/features/search/searchStore';
import { dragStore } from '@/features/planner/dragStore';
import { planStore } from './planStore';

/** The source query for the search that produced the current catalog, or null when
 * no search has run, stamped on a new entry so revalidation can replay it. */
function currentSourceQuery(): SourceQuery | null {
  const query = searchStore.getState().resultQuery;
  return query === null ? null : toSourceQuery(query);
}

// The catalog only renders once a search returns a result, so a term bearing source
// query is always present when a section can be added. A fresh empty conflict outcome
// guards the unreachable case rather than stamping a term-less entry that the plan term
// invariant rejects; it is built per call so no caller can mutate a shared instance.
export function addSectionToPlan(course: Course, section: Section): AddOutcome {
  const sourceQuery = currentSourceQuery();
  if (sourceQuery === null) {
    return { ok: false, conflicts: [] };
  }
  const outcome = planStore.getState().add(course, section, sourceQuery);
  // An exam overlap never blocks the add; when the added group clashes with an existing
  // entry's exam window, state it in the strip. The persistent warn badge is derived
  // separately from the entries, so this only drives the transient notice.
  if (outcome.ok) {
    const overlaps = addedExamWarnings(
      placedSections(outcome.result.entries),
      placedSections(outcome.result.added),
    );
    if (overlaps.length > 0) {
      dragStore
        .getState()
        .showExamWarning({ subjectId: section.subjectId, overlaps });
    }
  }
  return outcome;
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
    return { ok: false, conflicts: [] };
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
