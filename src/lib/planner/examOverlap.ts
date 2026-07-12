// Exam window overlaps between sections. An exam overlap is a hard block, enforced at add
// time by checkPlacement; this module provides the overlap primitives it reuses and derives
// the exam conflicts already present among a plan's placed entries, which arise only through
// revalidation or import and read danger like a time conflict. Two sections' exams collide
// only when both carry a well formed window of the same kind and the datetime ranges
// intersect, a midterm against a midterm and a final against a final, never a midterm against
// a final. The datetimes are the API's fixed width "YYYY-MM-DD HH:MM:SS" strings ordered by a
// lexicographic compare; a malformed or absent window is treated as no window, so a conflict
// is never invented from a datetime that cannot be ordered. Declared lecture and practice
// pairs share a subject's exam, so a pair never collides with itself.

import type { DateRange, Section } from '../domain/types';
import { isExamDateTime } from '../parsing/examDateTime';
import { areDeclaredPair } from './conflicts';
import type { EntryRef } from './placement';

export type ExamKind = 'midterm' | 'final';

/** A same kind exam window collision between two placed sections. It carries both
 * windows so the detail popover can show each side's dates. */
export interface ExamOverlap {
  /** The other placed section whose exam window collides. */
  blocking: EntryRef;
  kind: ExamKind;
  /** This section's window. */
  self: DateRange;
  /** The other section's window. */
  other: DateRange;
}

const EXAM_KINDS: readonly ExamKind[] = ['midterm', 'final'];

/** A window whose ends are both well formed exam datetimes and ordered start before end.
 * A value that fails the shape is treated as no window, so an overlap is never inferred
 * from a datetime that cannot be ordered. */
function isWindow(range: DateRange | undefined): range is DateRange {
  return (
    range !== undefined &&
    isExamDateTime(range.start) &&
    isExamDateTime(range.end) &&
    range.start < range.end
  );
}

/** Half open intersection, mirroring the meeting rule: touching endpoints are back to
 * back exams, not a clash. Both windows must already be well formed. */
function windowsIntersect(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Whether two exam windows overlap. False unless both are well formed. */
export function examWindowsOverlap(
  a: DateRange | undefined,
  b: DateRange | undefined,
): boolean {
  return isWindow(a) && isWindow(b) && windowsIntersect(a, b);
}

function toRef(section: Section): EntryRef {
  return {
    teachTableId: section.teachTableId,
    subjectId: section.subjectId,
    section: section.section,
  };
}

/** The same kind exam overlaps between two sections, described from `incoming`'s side
 * with `existing` as the blocker. */
export function sectionExamOverlaps(
  existing: Section,
  incoming: Section,
): ExamOverlap[] {
  const overlaps: ExamOverlap[] = [];
  for (const kind of EXAM_KINDS) {
    const self = incoming.exam[kind];
    const other = existing.exam[kind];
    if (isWindow(self) && isWindow(other) && windowsIntersect(self, other)) {
      overlaps.push({ blocking: toRef(existing), kind, self, other });
    }
  }
  return overlaps;
}

/** The exam overlaps each placed section has, keyed by teachTableId; a section with no
 * exam clash is absent. Declared pairs are skipped so a subject never clashes with its
 * own pair. Mirrors planConflicts so the grid derives the exam conflict badge the same way
 * it derives a time conflict badge; both read danger. */
export function planExamConflicts(
  sections: Section[],
): Map<string, ExamOverlap[]> {
  const conflicts = new Map<string, ExamOverlap[]>();
  const add = (id: string, overlap: ExamOverlap): void => {
    const list = conflicts.get(id);
    if (list === undefined) {
      conflicts.set(id, [overlap]);
    } else {
      list.push(overlap);
    }
  };
  for (let i = 0; i < sections.length; i += 1) {
    for (let j = i + 1; j < sections.length; j += 1) {
      const a = sections[i];
      const b = sections[j];
      if (a === undefined || b === undefined || areDeclaredPair(a, b)) {
        continue;
      }
      for (const overlap of sectionExamOverlaps(b, a)) {
        add(a.teachTableId, overlap);
      }
      for (const overlap of sectionExamOverlaps(a, b)) {
        add(b.teachTableId, overlap);
      }
    }
  }
  return conflicts;
}
