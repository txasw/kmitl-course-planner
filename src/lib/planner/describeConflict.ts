// Turn conflict details into a structured description the feedback UI localizes:
// the first blocking subject and section, the day and minute range for a time
// conflict, and a count of any further conflicts beyond the first. The UI turns
// this into the reason chip and the feedback strip sentence without reaching into
// the raw conflict shape.

import type { DayOfWeek } from '../parsing/days';
import type { ConflictDetail } from './placement';

export interface ConflictDescription {
  kind: 'time' | 'duplicate';
  subjectId: string;
  section: string;
  /** The clashing day for a time conflict, or null for a duplicate. */
  day: DayOfWeek | null;
  startMin: number | null;
  endMin: number | null;
  /** Conflicts beyond the first, for the count suffix. */
  moreCount: number;
}

/** Describe the first conflict and how many follow it, or null when there are none. */
export function describeConflicts(
  conflicts: ConflictDetail[],
): ConflictDescription | null {
  const first = conflicts[0];
  if (first === undefined) {
    return null;
  }
  const moreCount = Math.max(0, conflicts.length - 1);
  if (first.kind === 'time') {
    return {
      kind: 'time',
      subjectId: first.blocking.subjectId,
      section: first.blocking.section,
      day: first.day,
      startMin: first.startMin,
      endMin: first.endMin,
      moreCount,
    };
  }
  return {
    kind: 'duplicate',
    subjectId: first.blocking.subjectId,
    section: first.blocking.section,
    day: null,
    startMin: null,
    endMin: null,
    moreCount,
  };
}
