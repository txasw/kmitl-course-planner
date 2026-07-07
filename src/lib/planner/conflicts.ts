// Pure conflict predicates over normalized sections. Two meetings conflict when
// they fall on the same day and their minute ranges overlap; adjacency where one
// ends exactly as the other starts is not a conflict. A subject already in the
// plan blocks a second section unless the incoming section is its declared pair.

import type { DayOfWeek } from '../parsing/days';
import type { Meeting, Section } from '../domain/types';

/**
 * Two meetings overlap when they share a day and their half open ranges
 * intersect. `endMin === startMin` between neighbours is adjacency, not overlap.
 */
export function meetingsOverlap(a: Meeting, b: Meeting): boolean {
  return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin;
}

/** A day and the intersected minute range where two sections collide. */
export interface TimeOverlap {
  day: DayOfWeek;
  startMin: number;
  endMin: number;
}

/**
 * Every window where an existing section and an incoming section collide, keyed
 * to the day and the intersection of the two meeting ranges.
 */
export function sectionTimeOverlaps(
  existing: Section,
  incoming: Section,
): TimeOverlap[] {
  const overlaps: TimeOverlap[] = [];
  for (const e of existing.meetings) {
    for (const i of incoming.meetings) {
      if (meetingsOverlap(e, i)) {
        overlaps.push({
          day: e.day,
          startMin: Math.max(e.startMin, i.startMin),
          endMin: Math.min(e.endMin, i.endMin),
        });
      }
    }
  }
  return overlaps;
}

/** Whether two sections are the declared lecture and practice pair of a subject. */
export function areDeclaredPair(a: Section, b: Section): boolean {
  return (
    a.subjectId === b.subjectId &&
    (a.pairedSection === b.section || b.pairedSection === a.section)
  );
}

/**
 * Whether an incoming section is a blocked duplicate of an existing subject: same
 * subject, a different section, and not the existing section's declared pair.
 */
export function isDuplicateSubject(
  existing: Section,
  incoming: Section,
): boolean {
  return (
    existing.subjectId === incoming.subjectId &&
    existing.section !== incoming.section &&
    !areDeclaredPair(existing, incoming)
  );
}
