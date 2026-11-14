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
import type { AsyncState } from '../utils/async';

/** The four reference lists as the search feature holds them, each fetched on its own. */
export interface ReferenceLists {
  faculties: AsyncState<RawFaculty[]>;
  departments: AsyncState<RawDepartment[]>;
  curricula: AsyncState<RawCurriculum[]>;
  subjectOwners: AsyncState<RawSubjectOwner[]>;
}

/** A reference list's entries once it has loaded, or none while it is not ready. */
export function readyData<T>(state: AsyncState<T[]>): readonly T[] {
  return state.status === 'ready' ? state.data : [];
}

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
 * Whether a curriculum belongs to the faculty and department. A curriculum with an
 * empty department id applies to any department in the faculty.
 */
export function curriculumBelongsTo(
  curriculum: RawCurriculum,
  facultyId: string,
  departmentId: string,
): boolean {
  return (
    idsEqual(curriculum.FACULTY_ID, facultyId) &&
    (curriculum.REGISTRAR_DEPARTMENT_ID === '' ||
      idsEqual(curriculum.REGISTRAR_DEPARTMENT_ID, departmentId))
  );
}

/** Active curricula of the selected faculty and department. */
export function curriculaFor(
  curricula: readonly RawCurriculum[],
  facultyId: string,
  departmentId: string,
): RawCurriculum[] {
  return curricula.filter(
    (c) => c.ACTIVE === '1' && curriculumBelongsTo(c, facultyId, departmentId),
  );
}

/** One curriculum select option: the curriculum and the label it shows. */
export interface CurriculumOption {
  curriculum: RawCurriculum;
  label: string;
}

// Whitespace runs collapse so two names that render the same also compare the same.
function labelKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// Newest revision first; entries of one year follow their id, so the order never
// depends on the order the endpoint happened to return.
function newestFirst(a: RawCurriculum, b: RawCurriculum): number {
  return (
    b.YEAR.localeCompare(a.YEAR, undefined, { numeric: true }) ||
    a.REGISTRAR_CURRICULUM2_ID.localeCompare(
      b.REGISTRAR_CURRICULUM2_ID,
      undefined,
      { numeric: true },
    )
  );
}

// The revision year tells a colliding entry apart, and the curriculum id joins it
// when two entries of the group share that year too.
function revisionLabel(
  curriculum: RawCurriculum,
  group: readonly RawCurriculum[],
  locale: Locale,
): string {
  const year = curriculum.YEAR;
  const yearSeparates =
    year !== '' && group.filter((c) => c.YEAR === year).length === 1;
  const parts = [
    ...(year === '' ? [] : [year]),
    ...(yearSeparates ? [] : [curriculum.REGISTRAR_CURRICULUM2_ID]),
  ];
  return `${curriculumName(curriculum, locale)} (${parts.join(', ')})`;
}

/**
 * Labels for a filtered curriculum list in the active locale. A revision of a
 * curriculum often keeps its predecessor's short name, so only names that collide
 * get a revision suffix. Colliding entries sit together at the first one's
 * position, newest revision first; every other entry keeps its order and its
 * plain name.
 */
export function disambiguateCurricula(
  curricula: readonly RawCurriculum[],
  locale: Locale,
): CurriculumOption[] {
  const groups = new Map<string, RawCurriculum[]>();
  for (const curriculum of curricula) {
    const key = labelKey(curriculumName(curriculum, locale));
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [curriculum]);
    } else {
      group.push(curriculum);
    }
  }
  return [...groups.values()].flatMap((group) =>
    group.length === 1
      ? group.map((curriculum) => ({
          curriculum,
          label: curriculumName(curriculum, locale),
        }))
      : [...group].sort(newestFirst).map((curriculum) => ({
          curriculum,
          label: revisionLabel(curriculum, group, locale),
        })),
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
