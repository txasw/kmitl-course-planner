// The section total of a search result. The catalog summary line and the status
// announcer both name it, so the count lives here once rather than beside each reader.

import type { Course } from '../domain/types';

/** The number of deduped sections across every course of a result. */
export function countSections(courses: readonly Course[]): number {
  return courses.reduce((total, course) => total + course.sections.length, 0);
}
