// The name field of the plan switcher menu, shared by create and rename. Enter saves,
// and save stays disabled while the name is blank or past the name cap, which a rename of
// a plan named before the cap can start from. A live counter shows the room left. A create
// also picks the plan's year and semester, since a plan belongs to one term for life; a
// rename never offers it. The field is a text area that grows to the lines the name needs,
// so a long name shows whole rather than scrolled to its end with its first glyph cut at
// the field edge, while it keeps the one line behavior of a name: Enter saves, and a line
// break typed or pasted becomes a space.

import { useEffect, useId, useRef } from 'react';
import { useGrowingField } from './useGrowingField';
import { useTranslation } from '@/features/shell/useTranslation';
import { PLAN_NAME_MAX } from '@/lib/domain/plan';
import { fillTemplate } from '@/lib/i18n/template';
import {
  SEMESTERS,
  parseSemester,
  type Term,
} from '@/lib/routing/academicTerms';
import { CONTROL_BOUNDARY } from '@/lib/ui/control';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';

/** The term choice of a create: the chosen term, the years offered, ascending. */
export interface NameFormTerm {
  value: Term;
  years: readonly string[];
  onChange: (term: Term) => void;
}

/** A typed or pasted name on one line: each line break becomes a space. */
export function toOneLine(value: string): string {
  return value.replace(/\r\n|[\r\n]/g, ' ');
}

/** Whether a typed plan name can be saved: not blank and within the name cap. */
export function isSavableName(value: string): boolean {
  return value.trim() !== '' && value.length <= PLAN_NAME_MAX;
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
  const { t } = useTranslation();
  const inputId = useId();
  const limitId = useId();
  const enterId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useGrowingField(inputRef, value);
  // Focus the field on open so the user can name the plan straight away, done
  // through a ref rather than autoFocus to satisfy the accessibility lint.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 text-ink">
        <span className="flex items-center justify-between gap-2">
          <label htmlFor={inputId} className="font-semibold">
            {label}
          </label>
          {/* Outside the label so the field keeps its plain name, and hidden from
              assistive tech so it is not read on every keystroke; the described-by
              limit carries the cap a screen reader needs. */}
          <span aria-hidden className="text-xs tabular-nums text-ink-soft">
            {value.length}/{PLAN_NAME_MAX}
          </span>
        </span>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          value={value}
          maxLength={PLAN_NAME_MAX}
          // A text area reads as multi-line, but Enter saves the one line name, so the
          // description says so and a phone keyboard offers Done in place of a return key.
          aria-describedby={`${limitId} ${enterId}`}
          enterKeyHint="done"
          onChange={(event) => {
            onChange(toOneLine(event.target.value));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            }
          }}
          className={`resize-none overflow-hidden break-words rounded-kcp border px-2 py-1 text-ink ${CONTROL_BOUNDARY} ${FOCUS_RING}`}
        />
        <span id={limitId} className="sr-only">
          {fillTemplate(t('planSwitcher.nameLimit'), { max: PLAN_NAME_MAX })}
        </span>
        <span id={enterId} className="sr-only">
          {t('planSwitcher.nameEnterSaves')}
        </span>
      </div>
      {term === undefined ? null : <TermSelects {...term} />}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-kcp border border-border px-2 py-1 text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING} ${TARGET_SIZE}`}
        >
          {cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isSavableName(value)}
          className={`rounded-kcp bg-primary-strong px-2 py-1 font-semibold text-white hover:bg-primary-hover disabled:opacity-50 ${FOCUS_OUTLINE} ${TARGET_SIZE}`}
        >
          {save}
        </button>
      </div>
    </div>
  );
}
