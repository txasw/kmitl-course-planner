// The non drag paths to a swap and a move (ADR-0068), derived before anything commits so
// a control is offered only when its transaction would succeed. A replacement takes out
// the placed subject that blocks an add by time and puts the blocked section in. Both
// commit through applyPlanTransaction, so pair atomicity, the term check, and the exam
// hard block hold without checks of their own here.

import type { PlanEntry } from '../domain/plan';
import type { Course, Section } from '../domain/types';
import {
  checkPlacement,
  expandSectionGroup,
  type ConflictDetail,
} from './placement';
import { placedSections, removeEntry } from './transaction';

/** One blocking subject the blocked section could take the place of. */
export interface ReplaceOption {
  subjectId: string;
  /** The section codes that leave, the blocker and its declared pair. */
  sections: string[];
  /** The blocking entries to remove; each takes its declared pair with it. */
  removeIds: string[];
}

const byCode = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/**
 * The blocking subjects of a time conflict that the blocked section and its pair could
 * replace, in the order the conflicts name them. A subject is offered only when its
 * blocking entries are in the plan and, once they and their pairs leave, the blocked
 * group fits what is left, so a replacement never answers with the same refusal.
 */
export function replaceOptions(
  entries: PlanEntry[],
  course: Course,
  section: Section,
  conflicts: ConflictDetail[],
): ReplaceOption[] {
  const blockersBySubject = new Map<string, string[]>();
  for (const conflict of conflicts) {
    if (conflict.kind !== 'time') continue;
    const { subjectId, teachTableId } = conflict.blocking;
    const ids = blockersBySubject.get(subjectId) ?? [];
    if (!ids.includes(teachTableId)) {
      blockersBySubject.set(subjectId, [...ids, teachTableId]);
    }
  }
  const group = expandSectionGroup(course, section);
  return [...blockersBySubject].flatMap(([subjectId, removeIds]) => {
    let remaining = entries;
    const removed: PlanEntry[] = [];
    for (const id of removeIds) {
      const step = removeEntry(remaining, id);
      remaining = step.entries;
      removed.push(...step.removed);
    }
    if (
      removed.length === 0 ||
      !checkPlacement(placedSections(remaining), group).ok
    ) {
      return [];
    }
    return [
      {
        subjectId,
        sections: removed.map((entry) => entry.section).sort(byCode),
        removeIds,
      },
    ];
  });
}
