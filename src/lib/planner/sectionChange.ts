// The non drag paths to a swap and a move (ADR-0068), derived before anything commits so
// a control is offered only when its transaction would succeed. A replacement takes out
// the placed subject that blocks an add by time and puts the blocked section in. A change
// moves a placed subject to another of its section groups that is open and fits. Both
// commit through applyPlanTransaction, so pair atomicity, the term check, and the exam
// hard block hold without checks of their own here.

import type { PlanEntry } from '../domain/plan';
import type { Course, Section } from '../domain/types';
import { isSelectable } from '../catalog/seatStatus';
import {
  checkPlacement,
  expandSectionGroup,
  type ConflictDetail,
} from './placement';
import { earliestStart } from './suggestions';
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

/** Another section group of a placed subject that the plan could move to. */
export interface ChangeOption {
  /** The section a move targets; its declared pair joins it. */
  section: Section;
  /** The section and its declared pair, in section code order. */
  group: Section[];
}

function groupStart(option: ChangeOption): number {
  return Math.min(...option.group.map(earliestStart));
}

/**
 * The other section groups of a placed subject that the plan could move it to, soonest
 * first. A pair counts once, as its lecture and practice together. A group is kept when
 * it is not the one placed, every member is open, and it fits the plan once the placed
 * section and its pair leave. The placed group is matched by section code as well as
 * id, since a revalidation can move a section's id while its code stays.
 */
export function changeOptions(
  entries: PlanEntry[],
  course: Course,
  teachTableId: string,
): ChangeOption[] {
  const { entries: rest, removed } = removeEntry(entries, teachTableId);
  if (removed.length === 0) {
    return [];
  }
  const placedIds = new Set(removed.map((entry) => entry.teachTableId));
  const placedCodes = new Set(removed.map((entry) => entry.section));
  const placed = placedSections(rest);
  const seen = new Set<string>();
  const options: ChangeOption[] = [];
  for (const section of course.sections) {
    const group = [...expandSectionGroup(course, section)].sort((a, b) =>
      byCode(a.section, b.section),
    );
    const key = group.map((member) => member.teachTableId).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const isPlaced = group.some(
      (member) =>
        placedIds.has(member.teachTableId) || placedCodes.has(member.section),
    );
    if (
      !isPlaced &&
      group.every(isSelectable) &&
      checkPlacement(placed, group).ok
    ) {
      options.push({ section, group });
    }
  }
  return options.sort(
    (a, b) =>
      groupStart(a) - groupStart(b) ||
      byCode(a.section.section, b.section.section),
  );
}
