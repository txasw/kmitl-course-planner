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
  subjectOwnerName,
  type ReferenceLists,
} from '../reference/filters';
import type { AsyncState } from '../utils/async';

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

function readyData<T>(state: AsyncState<T[]>): readonly T[] {
  return state.status === 'ready' ? state.data : [];
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

function classYearQualifier(query: ByClassQuery, t: Translate): string {
  return query.search_all_class_year || query.selected_class_year === '0'
    ? t('search.classYearAll')
    : fillTemplate(t('search.summary.classYear'), {
        classYear: query.selected_class_year,
      });
}

function findDepartment(
  departments: readonly RawDepartment[],
  query: ByClassQuery,
): RawDepartment | undefined {
  return departments.find(
    (department) =>
      idsEqual(department.faculty_id, query.selected_faculty) &&
      idsEqual(department.department_id, query.selected_department),
  );
}

// The same scope rule as the form's options, and an active entry wins over a
// retired one, so a query saved before a curriculum retired still finds its name.
function findCurriculum(
  curricula: readonly RawCurriculum[],
  query: ByClassQuery,
): RawCurriculum | undefined {
  const matches = curricula.filter(
    (curriculum) =>
      curriculumBelongsTo(
        curriculum,
        query.selected_faculty,
        query.selected_department,
      ) &&
      idsEqual(curriculum.REGISTRAR_CURRICULUM2_ID, query.selected_curriculum),
  );
  return matches.find((curriculum) => curriculum.ACTIVE === '1') ?? matches[0];
}

function describeClass(query: ByClassQuery, context: Context): QuerySummary {
  const { reference, locale, t } = context;
  const classYear = classYearQualifier(query, t);
  const allCurricula =
    query.search_all_curriculum || query.selected_curriculum === 'x';
  if (!allCurricula) {
    return {
      primary: nameOr(
        findCurriculum(readyData(reference.curricula), query),
        (curriculum) => curriculumName(curriculum, locale),
        query.selected_curriculum,
      ),
      qualifiers: [classYear],
    };
  }
  const qualifiers = [t('search.curriculumAll'), classYear];
  const allDepartments =
    query.search_all_department || query.selected_department === 'x';
  if (allDepartments) {
    return {
      primary: facultyLabel(query.selected_faculty, context),
      qualifiers,
    };
  }
  return {
    primary: nameOr(
      findDepartment(readyData(reference.departments), query),
      (department) => departmentName(department, locale),
      query.selected_department,
    ),
    qualifiers,
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
      return describeClass(query, context);
  }
}
