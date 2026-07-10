// Exam window overlaps between placed sections. This is a warning, never a block: an
// add whose exam clashes still succeeds. Two sections' exams collide only when both
// carry a well formed window of the same kind and the datetime ranges intersect, a
// midterm against a midterm and a final against a final, never a midterm against a
// final. The datetimes are the API's fixed width "YYYY-MM-DD HH:MM:SS" strings, so a
// lexicographic compare is chronological and no date parser is needed; a malformed or
// absent window is treated as no window, so a warning is never invented from a datetime
// that cannot be ordered. Declared lecture and practice pairs share a subject's exam, so
// a pair never warns against itself.

import type { DateRange, Section } from '../domain/types';
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

// The API sends a fixed width "YYYY-MM-DD HH:MM:SS". A value that fails this shape is
// treated as no window, so an overlap is never inferred from a datetime we cannot order.
const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** A window whose ends are both well formed and ordered start before end. */
function isWindow(range: DateRange | undefined): range is DateRange {
  return (
    range !== undefined &&
    DATETIME.test(range.start) &&
    DATETIME.test(range.end) &&
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
 * own pair. Mirrors planConflicts so the grid derives an exam warning badge the same way
 * it derives a time conflict badge. */
export function planExamWarnings(
  sections: Section[],
): Map<string, ExamOverlap[]> {
  const warnings = new Map<string, ExamOverlap[]>();
  const add = (id: string, overlap: ExamOverlap): void => {
    const list = warnings.get(id);
    if (list === undefined) {
      warnings.set(id, [overlap]);
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
  return warnings;
}

/** The exam overlaps a newly added group has against the sections already placed. The
 * group's own members and any declared pair are excluded, so a lecture and practice pair
 * sharing an exam never warns against itself. Used once at commit time to state the
 * warning in the feedback strip. */
export function addedExamWarnings(
  placed: Section[],
  added: Section[],
): ExamOverlap[] {
  const addedIds = new Set(added.map((section) => section.teachTableId));
  const others = placed.filter(
    (section) => !addedIds.has(section.teachTableId),
  );
  const overlaps: ExamOverlap[] = [];
  // A lecture and practice pair share the subject's exam, so both halves clash with the
  // same blocker on the same kind. Count that as one clash so the strip's "+N" suffix is
  // honest, keyed by the blocking section and exam kind.
  const seen = new Set<string>();
  for (const incoming of added) {
    for (const existing of others) {
      if (areDeclaredPair(existing, incoming)) {
        continue;
      }
      for (const overlap of sectionExamOverlaps(existing, incoming)) {
        const key = `${overlap.blocking.teachTableId}:${overlap.kind}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        overlaps.push(overlap);
      }
    }
  }
  return overlaps;
}
