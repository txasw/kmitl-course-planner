// Add a section to the plan, stamping the entry's source query from the search
// that produced the current catalog so revalidation can later replay it. Both the
// catalog add button and the drag commit go through here, so the source query
// logic lives in one place. The confirmation of a catalog add lives here too, so
// every add path that can happen while the timetable is covered says so the same way.

import type { Course, Section } from '@/lib/domain/types';
import type { SourceQuery } from '@/lib/domain/plan';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { AddOutcome, TransactionOutcome } from '@/lib/planner/transaction';
import { toSourceQuery } from '@/lib/planner/sourceQuery';
import { BREAKPOINTS, minWidthQuery } from '@/lib/ui/breakpoints';
import { searchStore } from '@/features/search/searchStore';
import { CATALOG_TOGGLE_ID } from '@/features/shell/catalogVisibility';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
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
// invariant rejects; it is built per call so no caller can mutate a shared instance. An
// exam overlap is a hard block now, so it arrives as a conflict on the outcome and the
// feedback strip states it through the same rejected drop path as a time conflict.
export function addSectionToPlan(course: Course, section: Section): AddOutcome {
  const sourceQuery = currentSourceQuery();
  if (sourceQuery === null) {
    return { ok: false, conflicts: [] };
  }
  return planStore.getState().add(course, section, sourceQuery);
}

/**
 * Whether the timetable is out of view, so a new block lands where the student cannot
 * see it: the catalog sheet is open on a tier where it slides over the grid. A docked
 * column sits beside the grid, and hidden it cannot add, so the docked tiers never
 * cover it.
 */
function gridCovered(): boolean {
  return (
    uiStore.getState().sheetOpen &&
    !window.matchMedia(minWidthQuery(BREAKPOINTS.lg)).matches
  );
}

/**
 * Confirm a committed catalog add. While the timetable is covered, the outcome is not
 * visible on screen, so a toast names the section and offers the way to the timetable,
 * which closes the sheet and returns focus to the control that reopens it. The pane
 * never switches on its own, because the student is still picking from the list.
 */
export function confirmAdd(section: Section, t: Translate): void {
  if (!gridCovered()) {
    return;
  }
  toastStore.getState().show(
    'success',
    fillTemplate(t('toast.added'), {
      subject: section.subjectId,
      section: section.section,
    }),
    {
      label: t('toast.viewTimetable'),
      run: (control) => {
        commitAndFocus(control, CATALOG_TOGGLE_ID, () => {
          uiStore.getState().setSheetOpen(false);
        });
      },
    },
  );
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
