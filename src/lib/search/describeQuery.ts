// Name a teach table query in words for the search summary bar. The primary text says
// what was searched, the narrowest named selection of the query, and the qualifiers
// carry the scope that tells two otherwise alike searches apart, such as ทุกคณะ or
// ชั้นปี 4. The bar clamps the primary and never truncates a qualifier, so the scope
// stays readable however long a Thai category or curriculum name runs. Names come from
// the reference lists; while a list is not ready, or an id is not in it, the raw id
// stands in, so the bar always names something and fills in once the list arrives.

import type {
  RawCurriculum,
  RawDepartment,
  RawFaculty,
  RawSubjectOwner,
} from '../domain/schemas';
import type { OfferedTo } from '../domain/types';
import { pickLocalized } from '../i18n/localize';
import { fillTemplate } from '../i18n/template';
import type { Locale, Translate } from '../i18n/t';
import type { TeachTableQuery } from '../messaging/protocol';
import {
  curriculumBelongsTo,
  curriculumName,
  departmentName,
  facultyName,
  idsEqual,
  readyData,
  subjectOwnerName,
  type ReferenceLists,
} from '../reference/filters';

export interface QuerySummary {
  primary: string;
  qualifiers: string[];
}

type ByClassQuery = Extract<TeachTableQuery, { mode: 'by_class' }>;
type ByCategoryQuery = Extract<
  TeachTableQuery,
  { mode: 'by_subject_owner_id' }
>;

interface Context {
  reference: ReferenceLists;
  locale: Locale;
  t: Translate;
}

/** The looked up name, or the raw id when the entry is unknown or its name is blank. */
function nameOr<T>(
  entry: T | undefined,
  name: (entry: T) => string,
  rawId: string,
): string {
  const resolved = entry === undefined ? '' : name(entry).trim();
  return resolved === '' ? rawId : resolved;
}

function findFaculty(
  faculties: readonly RawFaculty[],
  facultyId: string,
): RawFaculty | undefined {
  return faculties.find((faculty) => idsEqual(faculty.FACULTY_ID, facultyId));
}

// The faculty endpoint swaps its acronym fields: ACRONYM_TH holds the English letters
// and ACRONYM_EN the Thai ones, so each locale reads the other field.
function facultyAcronym(faculty: RawFaculty, locale: Locale): string {
  return pickLocalized(faculty.ACRONYM_EN, faculty.ACRONYM_TH, locale);
}

function facultyLabel(facultyId: string, { reference, locale }: Context) {
  return nameOr(
    findFaculty(readyData(reference.faculties), facultyId),
    (faculty) => facultyName(faculty, locale),
    facultyId,
  );
}

// The x department and curriculum and the class 0 of a catch all grouping mean any.
const ANY_GROUPING_ID = 'x';
const ANY_CLASS_YEAR = '0';

function classYearQualifier(classYear: string, t: Translate): string {
  return classYear === ANY_CLASS_YEAR
    ? t('search.classYearAll')
    : fillTemplate(t('search.summary.classYear'), { classYear });
}

function findDepartment(
  departments: readonly RawDepartment[],
  grouping: OfferedTo,
): RawDepartment | undefined {
  return departments.find(
    (department) =>
      idsEqual(department.faculty_id, grouping.facultyId) &&
      idsEqual(department.department_id, grouping.departmentId),
  );
}

// The same scope rule as the form's options, and an active entry wins over a
// retired one, so a query saved before a curriculum retired still finds its name.
function findCurriculum(
  curricula: readonly RawCurriculum[],
  grouping: OfferedTo,
): RawCurriculum | undefined {
  const matches = curricula.filter(
    (curriculum) =>
      curriculumBelongsTo(
        curriculum,
        grouping.facultyId,
        grouping.departmentId,
      ) && idsEqual(curriculum.REGISTRAR_CURRICULUM2_ID, grouping.curriculumId),
  );
  return matches.find((curriculum) => curriculum.ACTIVE === '1') ?? matches[0];
}

function describeGroupingIn(
  grouping: OfferedTo,
  context: Context,
): QuerySummary {
  const { reference, locale, t } = context;
  const classYear = classYearQualifier(grouping.classYear, t);
  if (grouping.curriculumId !== ANY_GROUPING_ID) {
    return {
      primary: nameOr(
        findCurriculum(readyData(reference.curricula), grouping),
        (curriculum) => curriculumName(curriculum, locale),
        grouping.curriculumId,
      ),
      qualifiers: [classYear],
    };
  }
  const qualifiers = [t('search.curriculumAll'), classYear];
  if (grouping.departmentId === ANY_GROUPING_ID) {
    return {
      primary: facultyLabel(grouping.facultyId, context),
      qualifiers,
    };
  }
  return {
    primary: nameOr(
      findDepartment(readyData(reference.departments), grouping),
      (department) => departmentName(department, locale),
      grouping.departmentId,
    ),
    qualifiers,
  };
}

// A class query names one grouping; each search_all flag stands for the sentinel
// its catch all grouping carries.
function queryGrouping(query: ByClassQuery): OfferedTo {
  return {
    facultyId: query.selected_faculty,
    departmentId: query.search_all_department
      ? ANY_GROUPING_ID
      : query.selected_department,
    curriculumId: query.search_all_curriculum
      ? ANY_GROUPING_ID
      : query.selected_curriculum,
    classYear: query.search_all_class_year
      ? ANY_CLASS_YEAR
      : query.selected_class_year,
  };
}

function findSubjectOwner(
  owners: readonly RawSubjectOwner[],
  ownerId: string,
): RawSubjectOwner | undefined {
  return owners.find((owner) =>
    idsEqual(owner.TEACH_TABLE_SUBJECT_OWNER_ID, ownerId),
  );
}

function categoryFacultyQualifier(
  query: ByCategoryQuery,
  { reference, locale, t }: Context,
): string[] {
  if (query.search_all_faculty) {
    return [t('search.facultyAll')];
  }
  const facultyId = query.selected_faculty;
  if (facultyId === undefined) {
    return [];
  }
  const faculty = findFaculty(readyData(reference.faculties), facultyId);
  const acronym = faculty === undefined ? '' : facultyAcronym(faculty, locale);
  return [
    acronym.trim() === ''
      ? nameOr(faculty, (entry) => facultyName(entry, locale), facultyId)
      : acronym.trim(),
  ];
}

function describeCategory(
  query: ByCategoryQuery,
  context: Context,
): QuerySummary {
  const { reference, locale, t } = context;
  const name = nameOr(
    findSubjectOwner(
      readyData(reference.subjectOwners),
      query.selected_subject_owner_id,
    ),
    (owner) => subjectOwnerName(owner, locale),
    query.selected_subject_owner_id,
  );
  return {
    primary: fillTemplate(t('search.summary.byCategory'), { name }),
    qualifiers: categoryFacultyQualifier(query, context),
  };
}

/** Describe a query as a primary summary and the scope qualifiers that sit beside it. */
export function describeQuery(
  query: TeachTableQuery,
  reference: ReferenceLists,
  locale: Locale,
  t: Translate,
): QuerySummary {
  const context: Context = { reference, locale, t };
  switch (query.mode) {
    case 'by_subject_id':
      return {
        primary: fillTemplate(t('search.summary.bySubjectId'), {
          id: query.selected_subject_id,
        }),
        qualifiers: [],
      };
    case 'by_subject_owner_id':
      return describeCategory(query, context);
    case 'by_class':
      return describeGroupingIn(queryGrouping(query), context);
  }
}

/**
 * Describe one curriculum grouping, such as an offeredTo item or a curriculum
 * profile, in the words the summary bar uses for a class search of it.
 */
export function describeGrouping(
  grouping: OfferedTo,
  reference: ReferenceLists,
  locale: Locale,
  t: Translate,
): QuerySummary {
  return describeGroupingIn(grouping, { reference, locale, t });
}
