// Presentational form fields for the search rail. Each select derives its options
// from the reference lists through the pure filters, stays disabled until its
// source list is ready and its parent selection is made, and writes back through
// the store patch. Native controls carry accessible labels and a visible focus
// ring in the brand orange.

import { useId } from 'react';
import type { Translate } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/t';
import type {
  RawCurriculum,
  RawDepartment,
  RawFaculty,
  RawSubjectOwner,
} from '@/lib/domain/schemas';
import type { AsyncState } from '@/lib/utils/async';
import {
  curriculaFor,
  curriculumName,
  departmentName,
  departmentsForFaculty,
  facultyName,
  sortFacultiesById,
  sortSubjectOwners,
  subjectOwnerName,
} from '@/lib/reference/filters';
import {
  CLASS_YEARS,
  asClassYear,
  asSemester,
  type CategoryForm,
  type ClassForm,
} from '@/lib/search/formState';
import { SEMESTERS } from '@/lib/routing/academicTerms';

export interface ReferenceLists {
  faculties: AsyncState<RawFaculty[]>;
  departments: AsyncState<RawDepartment[]>;
  curricula: AsyncState<RawCurriculum[]>;
  subjectOwners: AsyncState<RawSubjectOwner[]>;
}

interface Option {
  value: string;
  label: string;
}

interface LabeledSelectProps {
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function LabeledSelect({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: LabeledSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="rounded-kcp border border-border bg-surface px-2 py-1.5 text-ink focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SubjectIdInputProps {
  label: string;
  value: string;
  hint: string;
  invalid: boolean;
  invalidMessage: string;
  onChange: (value: string) => void;
}

export function SubjectIdInput({
  label,
  value,
  hint,
  invalid,
  invalidMessage,
  onChange,
}: SubjectIdInputProps) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium text-ink">{label}</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={hint}
          aria-invalid={invalid}
          aria-describedby={hintId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="rounded-kcp border border-border bg-surface px-2 py-1.5 text-ink focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </label>
      <span id={hintId} className={invalid ? 'text-danger' : 'text-ink-soft'}>
        {invalid ? invalidMessage : hint}
      </span>
    </div>
  );
}

function readyData<T>(state: AsyncState<T[]>): T[] {
  return state.status === 'ready' ? state.data : [];
}

interface TermFieldsProps {
  year: string;
  semester: string;
  years: string[];
  t: Translate;
  onYear: (value: string) => void;
  onSemester: (value: string) => void;
}

export function TermFields({
  year,
  semester,
  years,
  t,
  onYear,
  onSemester,
}: TermFieldsProps) {
  return (
    <>
      <LabeledSelect
        label={t('search.year')}
        value={year}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        options={years.map((value) => ({ value, label: value }))}
        onChange={onYear}
      />
      <LabeledSelect
        label={t('search.semester')}
        value={semester}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        options={SEMESTERS.map((value) => ({ value, label: value }))}
        onChange={onSemester}
      />
    </>
  );
}

interface FacultySelectProps {
  value: string;
  faculties: AsyncState<RawFaculty[]>;
  locale: Locale;
  t: Translate;
  onChange: (value: string) => void;
}

export function FacultySelect({
  value,
  faculties,
  locale,
  t,
  onChange,
}: FacultySelectProps) {
  const options = sortFacultiesById(readyData(faculties)).map((faculty) => ({
    value: faculty.FACULTY_ID,
    label: `${faculty.FACULTY_ID} ${facultyName(faculty, locale)}`,
  }));
  return (
    <LabeledSelect
      label={t('search.faculty')}
      value={value}
      placeholder={
        faculties.status === 'ready'
          ? t('search.selectPlaceholder')
          : t('search.optionsLoading')
      }
      disabled={faculties.status !== 'ready'}
      options={options}
      onChange={onChange}
    />
  );
}

interface ClassFieldsProps {
  form: ClassForm;
  reference: ReferenceLists;
  years: string[];
  locale: Locale;
  t: Translate;
  patch: (patch: Partial<ClassForm>) => void;
}

export function ClassFields({
  form,
  reference,
  years,
  locale,
  t,
  patch,
}: ClassFieldsProps) {
  const departmentOptions = departmentsForFaculty(
    readyData(reference.departments),
    form.faculty,
  ).map((department) => ({
    value: department.department_id,
    label: `${department.department_id} ${departmentName(department, locale)}`,
  }));

  const curriculumOptions = curriculaFor(
    readyData(reference.curricula),
    form.faculty,
    form.department,
  ).map((curriculum) => ({
    value: curriculum.REGISTRAR_CURRICULUM2_ID,
    label: curriculumName(curriculum, locale),
  }));

  const classYearOptions = CLASS_YEARS.map((value) => ({
    value,
    label: value === 'all' ? t('search.classYearAll') : value,
  }));

  return (
    <>
      <TermFields
        year={form.year}
        semester={form.semester}
        years={years}
        t={t}
        onYear={(year) => {
          patch({ year });
        }}
        onSemester={(value) => {
          const semester = asSemester(value);
          if (semester !== null) {
            patch({ semester });
          }
        }}
      />
      <FacultySelect
        value={form.faculty}
        faculties={reference.faculties}
        locale={locale}
        t={t}
        onChange={(faculty) => {
          patch({ faculty, department: '', curriculum: '' });
        }}
      />
      <LabeledSelect
        label={t('search.department')}
        value={form.department}
        placeholder={t('search.selectPlaceholder')}
        disabled={
          form.faculty === '' || reference.departments.status !== 'ready'
        }
        options={departmentOptions}
        onChange={(department) => {
          patch({ department, curriculum: '' });
        }}
      />
      <LabeledSelect
        label={t('search.curriculum')}
        value={form.curriculum}
        placeholder={t('search.selectPlaceholder')}
        disabled={
          form.department === '' || reference.curricula.status !== 'ready'
        }
        options={curriculumOptions}
        onChange={(curriculum) => {
          patch({ curriculum });
        }}
      />
      <LabeledSelect
        label={t('search.classYear')}
        value={form.classYear}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        options={classYearOptions}
        onChange={(value) => {
          const classYear = asClassYear(value);
          if (classYear !== null) {
            patch({ classYear });
          }
        }}
      />
    </>
  );
}

interface CategoryFieldsProps {
  form: CategoryForm;
  reference: ReferenceLists;
  years: string[];
  locale: Locale;
  t: Translate;
  patch: (patch: Partial<CategoryForm>) => void;
}

export function CategoryFields({
  form,
  reference,
  years,
  locale,
  t,
  patch,
}: CategoryFieldsProps) {
  const ownerOptions = sortSubjectOwners(
    readyData(reference.subjectOwners),
    locale,
  ).map((owner) => ({
    value: owner.TEACH_TABLE_SUBJECT_OWNER_ID,
    label: subjectOwnerName(owner, locale),
  }));

  return (
    <>
      <TermFields
        year={form.year}
        semester={form.semester}
        years={years}
        t={t}
        onYear={(year) => {
          patch({ year });
        }}
        onSemester={(value) => {
          const semester = asSemester(value);
          if (semester !== null) {
            patch({ semester });
          }
        }}
      />
      <FacultySelect
        value={form.faculty}
        faculties={reference.faculties}
        locale={locale}
        t={t}
        onChange={(faculty) => {
          patch({ faculty });
        }}
      />
      <LabeledSelect
        label={t('search.subjectOwner')}
        value={form.subjectOwner}
        placeholder={
          reference.subjectOwners.status === 'ready'
            ? t('search.selectPlaceholder')
            : t('search.optionsLoading')
        }
        disabled={reference.subjectOwners.status !== 'ready'}
        options={ownerOptions}
        onChange={(subjectOwner) => {
          patch({ subjectOwner });
        }}
      />
    </>
  );
}
