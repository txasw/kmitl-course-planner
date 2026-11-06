// The search submit, a full width primary button that closes the field stack, so it
// sits directly under the last field on every tab and never drifts to the foot of a
// tall column.

import { Search } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { SEARCH_SUBMIT_ID } from './searchIds';

interface SearchSubmitProps {
  disabled: boolean;
  t: Translate;
  /** Called with the button, so the caller can move focus from it. */
  onSubmit: (from: HTMLButtonElement) => void;
}

export function SearchSubmit({ disabled, t, onSubmit }: SearchSubmitProps) {
  return (
    <button
      id={SEARCH_SUBMIT_ID}
      type="button"
      disabled={disabled}
      onClick={(event) => {
        onSubmit(event.currentTarget);
      }}
      className={`mt-1 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-kcp bg-primary-strong px-4 py-2 text-sm font-semibold text-surface hover:bg-primary-hover disabled:opacity-50 pointer-coarse:min-h-11 ${FOCUS_OUTLINE}`}
    >
      <Search size={16} strokeWidth={2} aria-hidden className="shrink-0" />
      {t('search.submit')}
    </button>
  );
}
