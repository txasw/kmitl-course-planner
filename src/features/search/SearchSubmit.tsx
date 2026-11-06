// The search submit, a full width primary button that closes the field stack, so it
// sits directly under the last field on every tab and never drifts to the foot of a
// tall column. A blocked submit stays focusable through aria-disabled and states why
// in a line under it that the button names as its description, so the reason is read
// on focus and seen without hovering. Its blocked style is a quiet neutral fill rather
// than a faded orange, which 8.2 rules out as a wash.
//
// On the phone layout the form fills the catalog pane, so the submit row is pinned to the
// bottom of the form scroller, above the bottom nav, and stays in reach however far the
// student scrolls the fields. There it can carry a cancel beside the submit, which folds
// the form back under the bar of the running search. The row is measured in every
// layout, so the scroller can pad its focus scroll clear of the pinned row.

import type { RefObject } from 'react';
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

/** Where the submit row sits, decided by the search head that owns the form scroller. */
export interface SubmitDock {
  /** The submit row, measured so the scroller keeps focus clear of it when pinned. */
  ref: RefObject<HTMLDivElement | null>;
  /** Pin the row to the bottom of the form scroller, for the full pane form. */
  sticky: boolean;
  /** Folds the form back under its bar, or null when there is no bar to fold to. */
  onCancel: ((from: HTMLButtonElement) => void) | null;
}

const ROW = 'mt-1 flex flex-col gap-1.5';

// The pinned row spans the form padding, so its surface covers the fields that scroll
// under it from edge to edge.
const STICKY_ROW = `${ROW} sticky bottom-0 -mx-6 border-t border-border bg-surface px-6 py-3`;

const BUTTON = `inline-flex min-h-9 items-center justify-center gap-2 rounded-kcp border px-4 py-2 text-sm pointer-coarse:min-h-11 ${FOCUS_OUTLINE}`;

interface SearchSubmitProps {
  /** Why the submit is blocked, or null when it can search. */
  reason: string | null;
  t: Translate;
  /** Called with the button, so the caller can move focus from it. */
  onSubmit: (from: HTMLButtonElement) => void;
  /** The row placement; without one the row sits in the flow with no cancel. */
  dock?: SubmitDock | undefined;
}

export function SearchSubmit({ reason, t, onSubmit, dock }: SearchSubmitProps) {
  const blocked = reason !== null;
  const onCancel = dock?.onCancel ?? null;
  return (
    <div ref={dock?.ref} className={dock?.sticky ? STICKY_ROW : ROW}>
      <div className="flex gap-2">
        {onCancel !== null ? (
          <button
            type="button"
            onClick={(event) => {
              onCancel(event.currentTarget);
            }}
            className={`${BUTTON} border-border bg-surface text-ink hover:bg-surface-alt`}
          >
            {t('search.cancelEdit')}
          </button>
        ) : null}
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
          className={`${BUTTON} flex-1 font-semibold ${
            blocked
              ? 'cursor-not-allowed border-border bg-surface-alt text-ink-soft'
              : 'border-transparent bg-primary-strong text-surface hover:bg-primary-hover'
          }`}
        >
          <Search size={16} strokeWidth={2} aria-hidden className="shrink-0" />
          {t('search.submit')}
        </button>
      </div>
      {blocked ? (
        <p id={REASON_ID} className="text-xs text-ink-soft">
          {reason}
        </p>
      ) : null}
    </div>
  );
}
