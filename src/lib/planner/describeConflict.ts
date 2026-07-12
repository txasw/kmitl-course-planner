// Turn conflict details into a structured description the feedback UI localizes:
// the first blocking subject and section, the day and minute range for a time
// conflict, and a count of any further conflicts beyond the first. The UI turns
// this into the reason chip and the feedback strip sentence without reaching into
// the raw conflict shape.

import type { DayOfWeek } from '../parsing/days';
import type { DateRange } from '../domain/types';
import type { ConflictDetail } from './placement';
import type { ExamKind } from './examOverlap';

export interface ConflictDescription {
  kind: 'time' | 'duplicate' | 'exam';
  subjectId: string;
  section: string;
  /** The clashing day for a time conflict, or null otherwise. */
  day: DayOfWeek | null;
  startMin: number | null;
  endMin: number | null;
  /** The exam kind and the added section's window for an exam conflict, null otherwise, so
   * the reason can name the exam type and its date range. */
  examKind: ExamKind | null;
  examWindow: DateRange | null;
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
  const base = {
    subjectId: first.blocking.subjectId,
    section: first.blocking.section,
    day: null,
    startMin: null,
    endMin: null,
    examKind: null,
    examWindow: null,
    moreCount,
  };
  if (first.kind === 'time') {
    return {
      ...base,
      kind: 'time',
      day: first.day,
      startMin: first.startMin,
      endMin: first.endMin,
    };
  }
  if (first.kind === 'exam') {
    return {
      ...base,
      kind: 'exam',
      examKind: first.examKind,
      examWindow: first.self,
    };
  }
  return { ...base, kind: 'duplicate' };
}
