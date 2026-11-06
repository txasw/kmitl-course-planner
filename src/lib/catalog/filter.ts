// The instant, local catalog filter. Free text matches a course by its subject
// id or either name; the credit filter matches a course; the day, hide full, hide
// conflicting, and open to my curriculum filters narrow a course's sections. A
// course drops out when no section survives. The seat and conflict tests are
// injected as predicates so this module stays free of the planner and seat logic
// and remains pure.

import type { Course, DayOfWeek, OfferedTo, Section } from '../domain/types';
import { idsEqual } from '../reference/filters';
import type { CurriculumProfile } from './curriculumProfile';

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
  /** Keep only the sections offered to this curriculum, or null for every section. */
  curriculum: CurriculumProfile | null;
}

export const EMPTY_FILTER: CatalogFilter = {
  text: '',
  days: [],
  credit: null,
  hideFull: false,
  hideConflicting: false,
  hideUnscheduled: false,
  curriculum: null,
};

// The catch all groupings of a response carry these in place of a real id, and
// they mean any department or curriculum, and any class year.
const ANY_GROUPING_ID = 'x';
const ANY_CLASS_YEAR = '0';

function idMatches(dataId: string, wildcard: string, profileId: string) {
  return dataId === wildcard || idsEqual(dataId, profileId);
}

/**
 * Whether a section's offeredTo groupings include the profile's curriculum and
 * class year. The wildcards apply on the data side only, since a profile never
 * holds one. A section without the list, which only a snapshot stored before the
 * list existed can be, is kept: the filter hides only what it can judge.
 */
export function matchesOfferedTo(
  offeredTo: readonly OfferedTo[] | undefined,
  profile: CurriculumProfile,
): boolean {
  if (offeredTo === undefined) {
    return true;
  }
  return offeredTo.some(
    (grouping) =>
      idsEqual(grouping.facultyId, profile.facultyId) &&
      idMatches(grouping.departmentId, ANY_GROUPING_ID, profile.departmentId) &&
      idMatches(grouping.curriculumId, ANY_GROUPING_ID, profile.curriculumId) &&
      idMatches(grouping.classYear, ANY_CLASS_YEAR, profile.classYear),
  );
}

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
  if (
    filter.curriculum !== null &&
    !matchesOfferedTo(section.offeredTo, filter.curriculum)
  ) {
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
