// The name field of the plan switcher menu, shared by create and rename. Enter saves,
// and save stays disabled while the name is blank. A create also picks the plan's year
// and semester, since a plan belongs to one term for life; a rename never offers it.

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  SEMESTERS,
  parseSemester,
  type Term,
} from '@/lib/routing/academicTerms';
import { CONTROL_BOUNDARY } from '@/lib/ui/control';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';

/** The term choice of a create: the chosen term, the years offered, ascending. */
export interface NameFormTerm {
  value: Term;
  years: readonly string[];
  onChange: (term: Term) => void;
}

export interface NameFormProps {
  value: string;
  label: string;
  save: string;
  cancel: string;
  /** Present for a create, absent for a rename. */
  term?: NameFormTerm;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const SELECT_CLASS = `rounded-kcp border px-2 py-1 text-ink ${CONTROL_BOUNDARY} ${FOCUS_RING} ${TARGET_HEIGHT}`;

function TermSelects({ value, years, onChange }: NameFormTerm) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('search.termGroup')}
      className="grid grid-cols-2 gap-2 *:min-w-0"
    >
      <label className="flex flex-col gap-1 text-ink">
        <span className="font-semibold">{t('search.year')}</span>
        <select
          value={value.year}
          onChange={(event) => {
            onChange({ ...value, year: event.target.value });
          }}
          className={SELECT_CLASS}
        >
          {/* Newest first, as the search form lists them. */}
          {[...years].reverse().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-ink">
        <span className="font-semibold">{t('search.semester')}</span>
        <select
          value={value.semester}
          onChange={(event) => {
            const semester = parseSemester(event.target.value);
            if (semester !== null) {
              onChange({ ...value, semester });
            }
          }}
          className={SELECT_CLASS}
        >
          {SEMESTERS.map((semester) => (
            <option key={semester} value={semester}>
              {semester}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function NameForm({
  value,
  label,
  save,
  cancel,
  term,
  onChange,
  onSubmit,
  onCancel,
}: NameFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus the field on open so the user can name the plan straight away, done
  // through a ref rather than autoFocus to satisfy the accessibility lint.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-ink">
        <span className="font-semibold">{label}</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            }
          }}
          className={`rounded-kcp border px-2 py-1 text-ink ${CONTROL_BOUNDARY} ${FOCUS_RING}`}
        />
      </label>
      {term === undefined ? null : <TermSelects {...term} />}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-kcp border border-border px-2 py-1 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TARGET_SIZE}`}
        >
          {cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.trim() === ''}
          className={`rounded-kcp bg-primary-strong px-2 py-1 font-semibold text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${TARGET_SIZE}`}
        >
          {save}
        </button>
      </div>
    </div>
  );
}
