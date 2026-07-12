// Placement validation. `checkPlacement` runs once when a drag starts, because
// every section has a fixed footprint, and decides whether an atomic section
// group can join the already placed sections. It reports each blocking collision
// as a ConflictDetail naming the blocking entry and, for time conflicts, the day
// and minute range so the grid can highlight exact cells.

import type { DayOfWeek } from '../parsing/days';
import type { Course, DateRange, Section } from '../domain/types';
import {
  areDeclaredPair,
  isDuplicateSubject,
  sectionTimeOverlaps,
} from './conflicts';
import { sectionExamOverlaps, type ExamKind } from './examOverlap';

/** Identity of a section involved in a conflict. */
export interface EntryRef {
  teachTableId: string;
  subjectId: string;
  section: string;
}

export type ConflictDetail =
  | {
      kind: 'time';
      blocking: EntryRef;
      day: DayOfWeek;
      startMin: number;
      endMin: number;
    }
  | { kind: 'duplicate'; blocking: EntryRef; subjectId: string }
  | {
      kind: 'exam';
      blocking: EntryRef;
      examKind: ExamKind;
      self: DateRange;
      other: DateRange;
    };

export type PlacementResult =
  { ok: true } | { ok: false; conflicts: ConflictDetail[] };

function toRef(section: Section): EntryRef {
  return {
    teachTableId: section.teachTableId,
    subjectId: section.subjectId,
    section: section.section,
  };
}

/**
 * Expand a section into the group that must be placed atomically: itself, plus
 * its declared pair when that pair exists in the same course. A section whose
 * pair is missing from the course is placed alone.
 */
export function expandSectionGroup(
  course: Course,
  section: Section,
): Section[] {
  if (section.pairedSection === null) {
    return [section];
  }
  const pair = course.sections.find((s) => s.section === section.pairedSection);
  return pair ? [section, pair] : [section];
}

/**
 * Validate an atomic section group against the placed sections. The group is
 * accepted only when no member duplicates an existing subject, no member collides
 * in time with an existing section or another group member, and no member's exam
 * window collides with an existing section's exam of the same kind. Exam overlap is
 * a hard block, the same class as a time conflict, because a real exam clash cannot
 * be sat. Group members are a declared lecture and practice pair sharing one exam,
 * so no exam check runs between them; a pair never blocks itself.
 */
export function checkPlacement(
  placed: Section[],
  group: Section[],
): PlacementResult {
  const conflicts: ConflictDetail[] = [];
  const groupKeys = new Set(group.map((s) => s.teachTableId));
  const others = placed.filter((s) => !groupKeys.has(s.teachTableId));

  for (const incoming of group) {
    for (const existing of others) {
      if (isDuplicateSubject(existing, incoming)) {
        conflicts.push({
          kind: 'duplicate',
          blocking: toRef(existing),
          subjectId: incoming.subjectId,
        });
      }
      for (const overlap of sectionTimeOverlaps(existing, incoming)) {
        conflicts.push({ kind: 'time', blocking: toRef(existing), ...overlap });
      }
      if (!areDeclaredPair(existing, incoming)) {
        for (const overlap of sectionExamOverlaps(existing, incoming)) {
          conflicts.push({
            kind: 'exam',
            blocking: overlap.blocking,
            examKind: overlap.kind,
            self: overlap.self,
            other: overlap.other,
          });
        }
      }
    }
  }

  group.forEach((member, index) => {
    for (const other of group.slice(index + 1)) {
      for (const overlap of sectionTimeOverlaps(member, other)) {
        conflicts.push({ kind: 'time', blocking: toRef(member), ...overlap });
      }
    }
  });

  return conflicts.length === 0 ? { ok: true } : { ok: false, conflicts };
}
