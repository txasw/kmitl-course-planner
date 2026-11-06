// The search submit, a full width primary button that closes the field stack, so it
// sits directly under the last field on every tab and never drifts to the foot of a
// tall column. A blocked submit stays focusable through aria-disabled and states why
// in a line under it that the button names as its description, so the reason is read
// on focus and seen without hovering. Its blocked style is a quiet neutral fill rather
// than a faded orange, which 8.2 rules out as a wash.

import { Search } from 'lucide-react';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import type { SearchField } from '@/lib/search/formState';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { SEARCH_SUBMIT_ID } from './searchIds';

const REASON_ID = 'kcp-search-submit-reason';

// An incomplete subject id keeps the submit live and answers a press with the field's
// own inline message, so it has no blocked reason here.
type ReasonField = Exclude<SearchField, 'subjectId'>;

const MISSING_REASON: Record<ReasonField, TranslationKey> = {
  year: 'search.missing.year',
  faculty: 'search.missing.faculty',
  department: 'search.missing.department',
  curriculum: 'search.missing.curriculum',
  subjectOwner: 'search.missing.subjectOwner',
};

/** The blocked reason for a missing field, or null when the field blocks nothing. */
export function missingFieldReason(
  field: SearchField | null,
  t: Translate,
): string | null {
  return field === null || field === 'subjectId'
    ? null
    : t(MISSING_REASON[field]);
}

interface SearchSubmitProps {
  /** Why the submit is blocked, or null when it can search. */
  reason: string | null;
  t: Translate;
  /** Called with the button, so the caller can move focus from it. */
  onSubmit: (from: HTMLButtonElement) => void;
}

export function SearchSubmit({ reason, t, onSubmit }: SearchSubmitProps) {
  const blocked = reason !== null;
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <button
        id={SEARCH_SUBMIT_ID}
        type="button"
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? REASON_ID : undefined}
        onClick={(event) => {
          if (!blocked) {
            onSubmit(event.currentTarget);
          }
        }}
        className={`inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-kcp border px-4 py-2 text-sm font-semibold pointer-coarse:min-h-11 ${FOCUS_OUTLINE} ${
          blocked
            ? 'cursor-not-allowed border-border bg-surface-alt text-ink-soft'
            : 'border-transparent bg-primary-strong text-surface hover:bg-primary-hover'
        }`}
      >
        <Search size={16} strokeWidth={2} aria-hidden className="shrink-0" />
        {t('search.submit')}
      </button>
      {blocked ? (
        <p id={REASON_ID} className="text-xs text-ink-soft">
          {reason}
        </p>
      ) : null}
    </div>
  );
}
