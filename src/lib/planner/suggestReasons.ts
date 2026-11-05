// Why a curriculum course is left out of a suggested timetable. The reason is
// worked out from the same checkPlacement results the search used, so it names
// what the student would meet trying to add the course by hand.
//
// The reasons are checked from the least fixable to the most. A course with no
// open section group cannot be taken at all. An exam overlap that every open group
// shares with one subject cannot be avoided by picking another section, because a
// subject often sits one exam for all its sections; it names that subject. A
// course whose every open group collides with the locked entries names the first
// one it meets, since removing that entry is the student's call. Anything else
// fits on its own but not beside the chosen courses.

import type { Section } from '../domain/types';
import {
  checkPlacement,
  type EntryRef,
  type PlacementResult,
} from './placement';

export type LeftOutReason =
  | { kind: 'seats' }
  | { kind: 'exam'; blocking: EntryRef }
  | { kind: 'locked'; blocking: EntryRef }
  | { kind: 'noFit' };

function examBlockers(outcome: PlacementResult): EntryRef[] {
  if (outcome.ok) {
    return [];
  }
  return outcome.conflicts.flatMap((conflict) =>
    conflict.kind === 'exam' ? [conflict.blocking] : [],
  );
}

/** The subject whose exam collides with every outcome, lowest subject id first. */
function sharedExamBlocker(outcomes: PlacementResult[]): EntryRef | null {
  const [first = [], ...rest] = outcomes.map(examBlockers);
  const shared = first
    .filter((ref) =>
      rest.every((refs) =>
        refs.some((other) => other.subjectId === ref.subjectId),
      ),
    )
    .sort((a, b) => a.subjectId.localeCompare(b.subjectId));
  return shared[0] ?? null;
}

/**
 * The reason a course is not in a timetable. `open` holds the course's section
 * groups whose members are all open, `locked` the plan's fixed sections, and
 * `placed` the whole timetable, locked and chosen.
 */
export function leftOutReason(
  open: Section[][],
  locked: Section[],
  placed: Section[],
): LeftOutReason {
  if (open.length === 0) {
    return { kind: 'seats' };
  }
  const examBlocker = sharedExamBlocker(
    open.map((group) => checkPlacement(placed, group)),
  );
  if (examBlocker !== null) {
    return { kind: 'exam', blocking: examBlocker };
  }
  // A group whose own lecture and practice collide fails on its own; only a
  // conflict whose blocker is a locked entry may be named as one.
  const lockedIds = new Set(locked.map((section) => section.teachTableId));
  let lockedBlocker: EntryRef | null = null;
  for (const group of open) {
    const outcome = checkPlacement(locked, group);
    if (outcome.ok) {
      return { kind: 'noFit' };
    }
    lockedBlocker ??=
      outcome.conflicts.find((conflict) =>
        lockedIds.has(conflict.blocking.teachTableId),
      )?.blocking ?? null;
  }
  return lockedBlocker === null
    ? { kind: 'noFit' }
    : { kind: 'locked', blocking: lockedBlocker };
}
