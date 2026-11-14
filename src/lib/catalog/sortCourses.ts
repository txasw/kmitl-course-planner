// The catalog sort orders. The catalog sorts the courses inside each subject type
// heading, never the headings themselves, so the groups stay where the result put
// them. Each order ranks a course once by its visible sections, which the filter may
// have narrowed, and breaks a tie by subject id so the order is stable across renders.

import type { Course } from '../domain/types';
import { computeSeatStatus } from './seatStatus';

export const COURSE_SORT_KEYS = [
  'subjectId',
  'openSeats',
  'earliestStart',
] as const;

export type CourseSortKey = (typeof COURSE_SORT_KEYS)[number];

export const DEFAULT_COURSE_SORT: CourseSortKey = 'subjectId';

const MINUTES_PER_DAY = 24 * 60;

/**
 * The open seats across a course's sections. A full or closed section adds none, and
 * an open section with no cap, which the API sends as "-", makes the total unlimited.
 */
export function openSeatCount(course: Course): number {
  let total = 0;
  for (const section of course.sections) {
    const status = computeSeatStatus(section);
    if (status.kind !== 'open') continue;
    if (status.remaining === null) return Number.POSITIVE_INFINITY;
    total += status.remaining;
  }
  return total;
}

/**
 * The course's first meeting in week order, Sunday first like the grid rows, as
 * minutes from the start of the week. A course with no scheduled meeting ranks last.
 */
export function earliestStartMinute(course: Course): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const section of course.sections) {
    for (const meeting of section.meetings) {
      earliest = Math.min(
        earliest,
        meeting.day * MINUTES_PER_DAY + meeting.startMin,
      );
    }
  }
  return earliest;
}

// Compares without subtraction, since two unlimited ranks would subtract to NaN.
function compareNumbers(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** The rank a course sorts by under a key: ascending, so more seats rank lower. */
function rankOf(course: Course, key: CourseSortKey): number {
  switch (key) {
    case 'subjectId':
      return 0;
    case 'openSeats':
      return -openSeatCount(course);
    case 'earliestStart':
      return earliestStartMinute(course);
  }
}

/** A new array of the courses in the given order; the input is left as it was. */
export function sortCourses(
  courses: readonly Course[],
  key: CourseSortKey,
): Course[] {
  return courses
    .map((course) => ({ course, rank: rankOf(course, key) }))
    .sort(
      (a, b) =>
        compareNumbers(a.rank, b.rank) ||
        compareText(a.course.subjectId, b.course.subjectId),
    )
    .map(({ course }) => course);
}
