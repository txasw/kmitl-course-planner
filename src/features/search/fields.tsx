// Presentational form fields for the search rail. Each select derives its options
// from the reference lists through the pure filters, stays disabled until its
// source list is ready and its parent selection is made, and writes back through
// the store patch. The selects are searchable comboboxes, since faculty and
// curriculum lists are long.

import { useId, useRef, type RefObject } from 'react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { sanitizeSubjectId } from '@/lib/search/formState';
import { Combobox } from './Combobox';
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
  ALL_OPTION,
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

interface SubjectIdInputProps {
  label: string;
  value: string;
  hint: string;
  invalid: boolean;
  invalidMessage: string;
  /** Focused by the parent when a submit or Enter attempt fails validation. */
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  /** Called when Enter is pressed, so a keyboard submit routes like the button. */
  onSubmit?: () => void;
}

export function SubjectIdInput({
  label,
  value,
  hint,
  invalid,
  invalidMessage,
  inputRef,
  onChange,
  onSubmit,
}: SubjectIdInputProps) {
  const hintId = useId();
  // Keep an in flight IME composition intact by passing it through unsanitized, then
  // sanitize once it commits. A numeric field rarely sees composition, but a Thai IME
  // over the field must not be mangled mid stroke.
  const composing = useRef(false);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-ink">{label}</span>
          {/* Live digit counter. The eight mirrors the full subject id length.
              Hidden from assistive tech so it is not read on every keystroke; the
              described-by message carries the state a screen reader needs. */}
          <span aria-hidden className="text-xs tabular-nums text-ink-soft">
            {value.length}/8
          </span>
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={hint}
          aria-invalid={invalid}
          aria-describedby={hintId}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(composing.current ? raw : sanitizeSubjectId(raw));
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            onChange(sanitizeSubjectId(event.currentTarget.value));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSubmit) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className={`rounded-kcp border border-border bg-surface px-2 py-1.5 text-ink ${FOCUS_RING}`}
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
      <Combobox
        label={t('search.year')}
        value={year}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        options={years.map((value) => ({ value, label: value }))}
        onChange={onYear}
      />
      <Combobox
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
  /** Offer an all faculties option, verified only for the category tab. */
  includeAll?: boolean;
}

export function FacultySelect({
  value,
  faculties,
  locale,
  t,
  onChange,
  includeAll = false,
}: FacultySelectProps) {
  const options = [
    ...(includeAll
      ? [{ value: ALL_OPTION, label: t('search.facultyAll') }]
      : []),
    ...sortFacultiesById(readyData(faculties)).map((faculty) => ({
      value: faculty.FACULTY_ID,
      label: `${faculty.FACULTY_ID} ${facultyName(faculty, locale)}`,
    })),
  ];
  return (
    <Combobox
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

  const curriculumOptions = [
    { value: ALL_OPTION, label: t('search.curriculumAll') },
    ...curriculaFor(
      readyData(reference.curricula),
      form.faculty,
      form.department,
    ).map((curriculum) => ({
      value: curriculum.REGISTRAR_CURRICULUM2_ID,
      label: curriculumName(curriculum, locale),
    })),
  ];

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
      <Combobox
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
      <Combobox
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
      <Combobox
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
        includeAll
        onChange={(faculty) => {
          patch({ faculty });
        }}
      />
      <Combobox
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
