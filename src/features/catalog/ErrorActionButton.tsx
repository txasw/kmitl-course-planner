// The error card's one action, chosen by errorAction from the error. A retry replaces
// the card with the loading state, so focus moves to the summary bar above. An edit
// opens the form under the bar and leaves the card in place, so focus moves into the
// form: to the disclosure, or to the subject id field on its tab when the server
// rejected the id.

import type { Translate } from '@/lib/i18n/t';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import type { ErrorAction } from '@/features/search/errorMessage';
import {
  SEARCH_BAR_ID,
  SEARCH_DISCLOSURE_ID,
  SEARCH_SUBJECT_ID_INPUT_ID,
} from '@/features/search/searchIds';
import { searchStore } from '@/features/search/searchStore';
import { commitAndFocus } from '@/features/shell/commitAndFocus';

const ERROR_ACTION_CLASS = `rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${FOCUS_OUTLINE}`;

interface ErrorActionButtonProps {
  action: ErrorAction;
  t: Translate;
  onRetry: () => void;
}

export function ErrorActionButton({
  action,
  t,
  onRetry,
}: ErrorActionButtonProps) {
  if (action === 'retry') {
    return (
      <button
        type="button"
        onClick={(event) => {
          commitAndFocus(event.currentTarget, SEARCH_BAR_ID, onRetry);
        }}
        className={ERROR_ACTION_CLASS}
      >
        {t('action.retry')}
      </button>
    );
  }
  const subjectId = action === 'editSubjectId';
  return (
    <button
      type="button"
      onClick={(event) => {
        commitAndFocus(
          event.currentTarget,
          subjectId ? SEARCH_SUBJECT_ID_INPUT_ID : SEARCH_DISCLOSURE_ID,
          () => {
            const search = searchStore.getState();
            if (subjectId) {
              search.setActiveTab('by_subject_id');
            }
            search.setSearchFormOpen(true);
          },
        );
      }}
      className={ERROR_ACTION_CLASS}
    >
      {t('search.bar.edit')}
    </button>
  );
}
