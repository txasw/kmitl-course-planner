// The instant, local catalog filter. Free text matches a course by its subject
// id or either name; the credit filter matches a course; the day, hide full, and
// hide conflicting filters narrow a course's sections. A course drops out when no
// section survives. The seat and conflict tests are injected as predicates so
// this module stays free of the planner and seat logic and remains pure.

import type { Course, DayOfWeek, Section } from '../domain/types';

export interface CatalogFilter {
  /** Free text over subject id and both names. */
  text: string;
  /** Selected days; empty means every day. */
  days: DayOfWeek[];
  /** Exact credit to match, or null for any. */
  credit: number | null;
  hideFull: boolean;
  hideConflicting: boolean;
  /** Hide sections with no scheduled meeting, such as online courses. */
  hideUnscheduled: boolean;
}

export const EMPTY_FILTER: CatalogFilter = {
  text: '',
  days: [],
  credit: null,
  hideFull: false,
  hideConflicting: false,
  hideUnscheduled: false,
};

export interface SectionPredicates {
  isFull: (section: Section) => boolean;
  isConflicting: (course: Course, section: Section) => boolean;
}

function matchesText(course: Course, text: string): boolean {
  if (text === '') {
    return true;
  }
  const needle = text.toLowerCase();
  return (
    course.subjectId.toLowerCase().includes(needle) ||
    course.nameTh.toLowerCase().includes(needle) ||
    course.nameEn.toLowerCase().includes(needle)
  );
}

function keepSection(
  course: Course,
  section: Section,
  filter: CatalogFilter,
  predicates: SectionPredicates,
): boolean {
  if (
    filter.days.length > 0 &&
    !section.meetings.some((meeting) => filter.days.includes(meeting.day))
  ) {
    return false;
  }
  if (filter.hideFull && predicates.isFull(section)) {
    return false;
  }
  if (filter.hideConflicting && predicates.isConflicting(course, section)) {
    return false;
  }
  if (filter.hideUnscheduled && section.meetings.length === 0) {
    return false;
  }
  return true;
}

export function filterCourses(
  courses: Course[],
  filter: CatalogFilter,
  predicates: SectionPredicates,
): Course[] {
  const text = filter.text.trim();
  const result: Course[] = [];
  for (const course of courses) {
    if (!matchesText(course, text)) {
      continue;
    }
    if (filter.credit !== null && course.credit !== filter.credit) {
      continue;
    }
    const sections = course.sections.filter((section) =>
      keepSection(course, section, filter, predicates),
    );
    if (sections.length === 0) {
      continue;
    }
    // Keep the original course reference when every section survived, so a
    // re-filter that drops nothing returns identical course identities and a
    // memoized card can skip its re-render. Only a course that actually lost a
    // section gets a fresh object.
    result.push(
      sections.length === course.sections.length
        ? course
        : { ...course, sections },
    );
  }
  return result;
}
