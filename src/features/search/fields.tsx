// Presentational form fields for the search form. The term row is shared by every
// tab; each tab's own fields follow the tab bar. Each select derives its options
// from the reference lists through the pure filters, stays disabled until its
// source list is ready and its parent selection is made, and writes back through
// the store patch. The selects are searchable comboboxes, since faculty and
// curriculum lists are long.

import { useId, useRef, type RefObject } from 'react';
import { CONTROL_BOUNDARY } from '@/lib/ui/control';
import { FOCUS_RING } from '@/lib/ui/focus';
import { sanitizeSubjectId } from '@/lib/search/formState';
import { Combobox } from './Combobox';
import { CurriculumFields } from './CurriculumFields';
import { FacultySelect } from './FacultySelect';
import { SEARCH_SUBJECT_ID_INPUT_ID } from './searchIds';
import type { Translate } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/t';
import {
  readyData,
  sortSubjectOwners,
  subjectOwnerName,
  type ReferenceLists,
} from '@/lib/reference/filters';
import type { CategoryForm, ClassForm } from '@/lib/search/formState';
import {
  SEMESTERS,
  parseSemester,
  type Term,
} from '@/lib/routing/academicTerms';

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
  /** Called on Enter with the input, so the caller can move focus from it. */
  onSubmit?: (input: HTMLInputElement) => void;
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
          <span className="font-semibold text-ink">{label}</span>
          {/* Live digit counter. The eight mirrors the full subject id length.
              Hidden from assistive tech so it is not read on every keystroke; the
              described-by message carries the state a screen reader needs. */}
          <span aria-hidden className="text-xs tabular-nums text-ink-soft">
            {value.length}/8
          </span>
        </span>
        <input
          ref={inputRef}
          id={SEARCH_SUBJECT_ID_INPUT_ID}
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
              onSubmit(event.currentTarget);
            }
          }}
          className={`rounded-kcp border px-2 py-1.5 text-ink ${CONTROL_BOUNDARY} ${FOCUS_RING}`}
        />
      </label>
      <span id={hintId} className={invalid ? 'text-danger' : 'text-ink-soft'}>
        {invalid ? invalidMessage : hint}
      </span>
    </div>
  );
}

interface TermFieldsProps {
  term: Term;
  years: string[];
  t: Translate;
  onChange: (patch: Partial<Term>) => void;
}

/**
 * The year and semester every tab searches, side by side in one labelled row. It
 * renders once above the tabs rather than inside each tab's fields, so it reads as
 * the term the whole form targets and a tab switch leaves it in place.
 */
export function TermFields({ term, years, t, onChange }: TermFieldsProps) {
  return (
    <div
      role="group"
      aria-label={t('search.termGroup')}
      className="grid grid-cols-2 gap-3 *:min-w-0"
    >
      <Combobox
        label={t('search.year')}
        value={term.year}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        // List the years newest first, the term a returning student most often
        // wants. A copy is reversed so the ascending source array, which the term
        // seed reads as newest last, is left untouched.
        options={[...years].reverse().map((value) => ({ value, label: value }))}
        onChange={(year) => {
          onChange({ year });
        }}
      />
      <Combobox
        label={t('search.semester')}
        value={term.semester}
        placeholder={t('search.selectPlaceholder')}
        disabled={false}
        options={SEMESTERS.map((value) => ({ value, label: value }))}
        onChange={(value) => {
          const semester = parseSemester(value);
          if (semester !== null) {
            onChange({ semester });
          }
        }}
      />
    </div>
  );
}

interface ClassFieldsProps {
  form: ClassForm;
  reference: ReferenceLists;
  locale: Locale;
  t: Translate;
  patch: (patch: Partial<ClassForm>) => void;
}

export function ClassFields({
  form,
  reference,
  locale,
  t,
  patch,
}: ClassFieldsProps) {
  return (
    <CurriculumFields
      value={form}
      includeAll
      reference={reference}
      locale={locale}
      t={t}
      patch={patch}
    />
  );
}

interface CategoryFieldsProps {
  form: CategoryForm;
  reference: ReferenceLists;
  locale: Locale;
  t: Translate;
  patch: (patch: Partial<CategoryForm>) => void;
}

export function CategoryFields({
  form,
  reference,
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
