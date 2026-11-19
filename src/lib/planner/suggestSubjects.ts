// The subjects a plan suggestion may fit, as the student ticks them (ADR-0054, as
// amended). Every course of the result that is not already in the plan can be
// ticked. The curriculum subjects of group 2 start ticked, since a curriculum
// expects them; GenEd and free electives of group 1, and a course whose heading
// names no group, start unticked and join only when the student ticks them. The
// ticked set is the whole subject count: there is no separate number to choose.

import { isCurriculumCourse } from '../catalog/subjectGroup';
import type { Course } from '../domain/types';
import type { PlanEntry } from '../domain/plan';

export interface SuggestSubjectGroups {
  /** Group 2 curriculum courses, ticked by default. */
  curriculum: Course[];
  /** Every other course, unticked by default. */
  other: Course[];
}

/** The courses a student can tick, split by their default, in result order. */
export function suggestableCourses(
  courses: readonly Course[],
  locked: readonly PlanEntry[],
): SuggestSubjectGroups {
  const lockedSubjects = new Set(locked.map((entry) => entry.subjectId));
  const open = courses.filter(
    (course) => !lockedSubjects.has(course.subjectId),
  );
  return {
    curriculum: open.filter(isCurriculumCourse),
    other: open.filter((course) => !isCurriculumCourse(course)),
  };
}

/** The subject ids ticked when the suggestion dialog opens. */
export function defaultSuggestSubjects(
  courses: readonly Course[],
  locked: readonly PlanEntry[],
): Set<string> {
  return new Set(
    suggestableCourses(courses, locked).curriculum.map(
      (course) => course.subjectId,
    ),
  );
}
