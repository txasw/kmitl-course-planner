// The faculty, department, curriculum, and class year selects of one curriculum
// grouping. The class search tab renders them with its all options, which only a
// search can send (curriculum x and class year 0 with their search_all flags). The
// curriculum profile picker renders them without, since a profile names the one
// curriculum and year a student studies in. The term is not part of a grouping, so
// it stays outside. A faculty change clears the department and curriculum, and a
// department change clears the curriculum, because their options depend on it.

import { GraduationCap } from 'lucide-react';
import { Combobox } from './Combobox';
import { FacultySelect } from './FacultySelect';
import type { Locale, Translate } from '@/lib/i18n/t';
import {
  curriculaFor,
  departmentName,
  departmentsForFaculty,
  disambiguateCurricula,
  readyData,
  type ReferenceLists,
} from '@/lib/reference/filters';
import type { CurriculumSelection } from '@/lib/catalog/curriculumProfile';
import {
  ALL_OPTION,
  CLASS_YEARS,
  asClassYear,
  type ClassForm,
} from '@/lib/search/formState';

interface CurriculumFieldsProps {
  value: CurriculumSelection;
  /** Offer the all curricula and all class years options a search can send. */
  includeAll: boolean;
  reference: ReferenceLists;
  locale: Locale;
  t: Translate;
  patch: (patch: Partial<ClassForm>) => void;
}

export function CurriculumFields({
  value,
  includeAll,
  reference,
  locale,
  t,
  patch,
}: CurriculumFieldsProps) {
  const departmentOptions = departmentsForFaculty(
    readyData(reference.departments),
    value.faculty,
  ).map((department) => ({
    value: department.department_id,
    label: `${department.department_id} ${departmentName(department, locale)}`,
  }));

  const curriculumOptions = [
    ...(includeAll
      ? [{ value: ALL_OPTION, label: t('search.curriculumAll') }]
      : []),
    ...disambiguateCurricula(
      curriculaFor(
        readyData(reference.curricula),
        value.faculty,
        value.department,
      ),
      locale,
    ).map(({ curriculum, label }) => ({
      value: curriculum.REGISTRAR_CURRICULUM2_ID,
      label,
    })),
  ];

  const classYearOptions = CLASS_YEARS.filter(
    (classYear) => includeAll || classYear !== ALL_OPTION,
  ).map((classYear) => ({
    value: classYear,
    label: classYear === ALL_OPTION ? t('search.classYearAll') : classYear,
  }));

  return (
    <>
      <FacultySelect
        value={value.faculty}
        faculties={reference.faculties}
        locale={locale}
        t={t}
        onChange={(faculty) => {
          patch({ faculty, department: '', curriculum: '' });
        }}
      />
      <Combobox
        label={t('search.department')}
        value={value.department}
        placeholder={t('search.selectPlaceholder')}
        disabled={
          value.faculty === '' || reference.departments.status !== 'ready'
        }
        options={departmentOptions}
        onChange={(department) => {
          patch({ department, curriculum: '' });
        }}
      />
      <Combobox
        label={t('search.curriculum')}
        icon={GraduationCap}
        value={value.curriculum}
        placeholder={t('search.selectPlaceholder')}
        disabled={
          value.department === '' || reference.curricula.status !== 'ready'
        }
        options={curriculumOptions}
        onChange={(curriculum) => {
          patch({ curriculum });
        }}
      />
      <Combobox
        label={t('search.classYear')}
        value={value.classYear}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        options={classYearOptions}
        onChange={(next) => {
          const classYear = asClassYear(next);
          if (classYear !== null) {
            patch({ classYear });
          }
        }}
      />
    </>
  );
}
