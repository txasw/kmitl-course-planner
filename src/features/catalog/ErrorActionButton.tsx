// The error card's one action, chosen by errorAction from the error, and the edit action
// it shares with the empty result, which reopens the form the same way. A retry replaces
// the card with the loading state, so focus moves to the summary bar above. An edit
// opens the form under the bar and leaves the card in place, so focus moves into the
// form: to the disclosure, or to the subject id field on its tab when the server
// rejected the id.

import type { Translate } from '@/lib/i18n/t';
import { EmptyStateAction } from '@/components/EmptyState';
import type { ErrorAction } from '@/features/search/errorMessage';
import {
  SEARCH_BAR_ID,
  SEARCH_DISCLOSURE_ID,
  SEARCH_SUBJECT_ID_INPUT_ID,
} from '@/features/search/searchIds';
import { searchStore } from '@/features/search/searchStore';
import { commitAndFocus } from '@/features/shell/commitAndFocus';

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
      <EmptyStateAction
        label={t('action.retry')}
        onClick={(event) => {
          commitAndFocus(event.currentTarget, SEARCH_BAR_ID, onRetry);
        }}
      />
    );
  }
  return <EditSearchAction subjectId={action === 'editSubjectId'} t={t} />;
}

interface EditSearchActionProps {
  t: Translate;
  /** Whether the server rejected the subject id, so the edit opens on its tab. */
  subjectId?: boolean;
}

export function EditSearchAction({
  t,
  subjectId = false,
}: EditSearchActionProps) {
  return (
    <EmptyStateAction
      label={t('search.bar.edit')}
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
    />
  );
}
