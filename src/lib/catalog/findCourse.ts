// Resolve a full Course from a normalized catalog by its subject id. A plan entry
// stores only its own section snapshot, not the course's sibling sections or pair
// links, so moving or swapping a placed block needs the Course looked up from the
// latest search result. Returns null when that subject is not in the catalog, which
// is the signal to degrade a block move to remove only.

import type { Course } from '../domain/types';

/** Find the course with this subject id in a catalog, or null when absent. */
export function findCourseBySubjectId(
  courses: Course[],
  subjectId: string,
): Course | null {
  return courses.find((course) => course.subjectId === subjectId) ?? null;
}
