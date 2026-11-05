// Classify a course by the subject type heading the API grouped it under. The teach
// table response splits every curriculum grouping into two headings: group 1 holds
// GenEd and free electives, which a student may take or leave, and group 2 holds the
// faculty required, curriculum required, and curriculum elective subjects a
// curriculum expects. Only the leading group number is read, in Thai or English, so a
// wording change in the rest of the heading does not move a course between groups.
// A heading that names neither group, or whose two languages disagree, is unknown,
// and an unknown course is never treated as part of a curriculum.
//
// The heading patterns live here as the single source the contract auditor imports,
// so a drifted heading reaches the data quality report instead of silently dropping
// courses out of the curriculum set.

import type { Course } from '../domain/types';

export type SubjectGroupKind = 'curriculum' | 'general' | 'unknown';

/** The Thai heading prefix, capturing the group number. */
export const SUBJECT_GROUP_HEADING_TH = /^\s*กลุ่ม\s*([12])(?!\d)/;

/** The English heading prefix, capturing the group number. */
export const SUBJECT_GROUP_HEADING_EN = /^\s*group\s*([12])(?!\d)/i;

const KIND_BY_NUMBER: Readonly<Record<string, SubjectGroupKind>> = {
  '1': 'general',
  '2': 'curriculum',
};

function kindOf(heading: string, pattern: RegExp): SubjectGroupKind {
  const number = pattern.exec(heading)?.[1];
  return number === undefined
    ? 'unknown'
    : (KIND_BY_NUMBER[number] ?? 'unknown');
}

/**
 * The group a course belongs to. One language is enough when the other heading is
 * missing or unreadable; two readable headings that disagree give unknown, since
 * neither can be trusted over the other.
 */
export function classifySubjectGroup(
  course: Pick<Course, 'groupNameTh' | 'groupNameEn'>,
): SubjectGroupKind {
  const th = kindOf(course.groupNameTh, SUBJECT_GROUP_HEADING_TH);
  const en = kindOf(course.groupNameEn, SUBJECT_GROUP_HEADING_EN);
  if (th === 'unknown') {
    return en;
  }
  if (en === 'unknown' || en === th) {
    return th;
  }
  return 'unknown';
}

/** Whether a course is a curriculum subject, the only kind a suggestion may choose. */
export function isCurriculumCourse(
  course: Pick<Course, 'groupNameTh' | 'groupNameEn'>,
): boolean {
  return classifySubjectGroup(course) === 'curriculum';
}
