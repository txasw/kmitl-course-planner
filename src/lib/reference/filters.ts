// Client side selectors over the reference lists. The gateway returns the full,
// unfiltered reference arrays; the dependent search selects derive their options
// here. Ids across the endpoints vary in width ("01" versus "1", "121"), so
// comparisons go through idsEqual rather than assuming zero padding, and a
// curriculum with an empty department id applies to any department in its faculty.

import type {
  RawCurriculum,
  RawDepartment,
  RawFaculty,
  RawSubjectOwner,
} from '../domain/schemas';
import type { Locale } from '../i18n/t';
import { pickLocalized } from '../i18n/localize';

const NUMERIC = /^\d+$/;

/**
 * Compare two id strings, tolerant of zero padding width differences such as
 * "01" and "1", without assuming any fixed width. Non numeric ids compare by
 * exact string equality.
 */
export function idsEqual(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  if (NUMERIC.test(a) && NUMERIC.test(b)) {
    return Number(a) === Number(b);
  }
  return false;
}

/** Faculties sorted by id for display. */
export function sortFacultiesById(
  faculties: readonly RawFaculty[],
): RawFaculty[] {
  return [...faculties].sort((a, b) =>
    a.FACULTY_ID.localeCompare(b.FACULTY_ID, undefined, { numeric: true }),
  );
}

/** Departments belonging to the selected faculty. */
export function departmentsForFaculty(
  departments: readonly RawDepartment[],
  facultyId: string,
): RawDepartment[] {
  return departments.filter((d) => idsEqual(d.faculty_id, facultyId));
}

/**
 * Active curricula of the selected faculty and department. A curriculum with an
 * empty department id applies to any department in the faculty and is always
 * included.
 */
export function curriculaFor(
  curricula: readonly RawCurriculum[],
  facultyId: string,
  departmentId: string,
): RawCurriculum[] {
  return curricula.filter(
    (c) =>
      c.ACTIVE === '1' &&
      idsEqual(c.FACULTY_ID, facultyId) &&
      (c.REGISTRAR_DEPARTMENT_ID === '' ||
        idsEqual(c.REGISTRAR_DEPARTMENT_ID, departmentId)),
  );
}

/** Subject owner groups sorted by their display name in the active locale. */
export function sortSubjectOwners(
  owners: readonly RawSubjectOwner[],
  locale: Locale,
): RawSubjectOwner[] {
  const collator = new Intl.Collator(locale === 'th' ? 'th' : 'en');
  return [...owners].sort((a, b) =>
    collator.compare(subjectOwnerName(a, locale), subjectOwnerName(b, locale)),
  );
}

export function facultyName(faculty: RawFaculty, locale: Locale): string {
  return pickLocalized(
    faculty.FACULTY_NAME_TH,
    faculty.FACULTY_NAME_EN,
    locale,
  );
}

export function departmentName(
  department: RawDepartment,
  locale: Locale,
): string {
  return pickLocalized(
    department.department_name_th,
    department.department_name_en,
    locale,
  );
}

export function curriculumName(
  curriculum: RawCurriculum,
  locale: Locale,
): string {
  return pickLocalized(
    curriculum.SHORT_NAME_TH,
    curriculum.SHORT_NAME_EN,
    locale,
  );
}

export function subjectOwnerName(
  owner: RawSubjectOwner,
  locale: Locale,
): string {
  return pickLocalized(
    owner.TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_TH,
    owner.TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_EN,
    locale,
  );
}
