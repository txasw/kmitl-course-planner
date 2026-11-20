// The subjects a plan suggestion may fit, as the student ticks them (ADR-0054, as
// amended). The subjects already in the plan form their own group, ticked by
// default: a ticked one is in every suggestion, at its current section or another
// open one, and an unticked one is left out of the suggested timetable. Every
// other course of the result can be ticked too. The curriculum subjects of group 2
// start ticked, since a curriculum expects them; GenEd and free electives of group
// 1, and a course whose heading names no group, start unticked and join only when
// the student ticks them. The ticked set is the whole subject count: there is no
// separate number to choose.

import { isCurriculumCourse } from '../catalog/subjectGroup';
import { snapshotToSection, type PlanEntry } from '../domain/plan';
import type { Course, Section } from '../domain/types';

export interface SuggestSubjectGroups {
  /** The subjects already in the plan, ticked by default. */
  planned: Course[];
  /** Group 2 curriculum courses, ticked by default. */
  curriculum: Course[];
  /** Every other course, unticked by default. */
  other: Course[];
}

/** A subject already in the plan, with the sections the plan holds for it. */
export interface PlannedSubject {
  /**
   * The result's course for the subject, whose open sections it may move to, or,
   * for a subject the result does not hold, a course of the plan's own sections.
   */
  course: Course;
  /** The plan's sections of the subject: one section, or a declared pair. */
  current: Section[];
}

/** The plan's subjects in the order they were added, each with its course. */
export function plannedSubjects(
  courses: readonly Course[],
  entries: readonly PlanEntry[],
): PlannedSubject[] {
  const held = new Map<
    string,
    { meta: PlanEntry['snapshot']['subjectMeta']; current: Section[] }
  >();
  for (const entry of entries) {
    const section = snapshotToSection(entry.snapshot);
    const found = held.get(entry.subjectId);
    if (found === undefined) {
      held.set(entry.subjectId, {
        meta: entry.snapshot.subjectMeta,
        current: [section],
      });
    } else {
      found.current.push(section);
    }
  }
  return [...held].map(([subjectId, { meta, current }]) => ({
    course: courses.find((c) => c.subjectId === subjectId) ?? {
      ...meta,
      subjectId,
      groupNameTh: '',
      groupNameEn: '',
      sections: current,
    },
    current,
  }));
}

/** The courses a student can tick, split by their default, in plan and result order. */
export function suggestableCourses(
  courses: readonly Course[],
  entries: readonly PlanEntry[],
): SuggestSubjectGroups {
  const planned = plannedSubjects(courses, entries).map(({ course }) => course);
  const inPlan = new Set(planned.map((course) => course.subjectId));
  const open = courses.filter((course) => !inPlan.has(course.subjectId));
  return {
    planned,
    curriculum: open.filter(isCurriculumCourse),
    other: open.filter((course) => !isCurriculumCourse(course)),
  };
}

/** The subject ids ticked when the suggestion dialog opens. */
export function defaultSuggestSubjects(
  courses: readonly Course[],
  entries: readonly PlanEntry[],
): Set<string> {
  const groups = suggestableCourses(courses, entries);
  return new Set(
    [...groups.planned, ...groups.curriculum].map((course) => course.subjectId),
  );
}
