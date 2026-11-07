// The one action at the end of the summary bar: an icon button that loads the results
// of the search again, bypassing the cache, so the seats and closures on screen catch up
// on demand. It runs in the background and leaves the disclosure as the student set it.
// It stays mounted while the query runs, so focus stays on it: it is aria-disabled then
// and described by the busy text beside it, rather than replaced by it. A changed result
// is visible in the catalog, so only a refresh that changed nothing confirms itself
// through a toast.

import { useStore } from 'zustand';
import { RefreshCw } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { toastStore } from '@/features/shell/toastStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { useSearchDeps } from './SearchDepsContext';
import { searchStore } from './searchStore';
import { useSearchActions } from './useSearchController';

interface ResultActionProps {
  /** The id of the status slot that reads the busy text while the query runs. */
  statusId: string;
}

export function ResultAction({ statusId }: ResultActionProps) {
  const { t } = useTranslation();
  const { refreshResult } = useSearchActions(useSearchDeps());
  const busy = useStore(
    searchStore,
    (state) => state.result.status === 'loading',
  );
  const label = t('search.bar.refresh');

  const handleClick = (): void => {
    if (busy) return;
    void (async () => {
      if ((await refreshResult()) === 'unchanged') {
        toastStore.getState().show('success', t('toast.refreshUnchanged'));
      }
    })();
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={busy || undefined}
      aria-describedby={busy ? statusId : undefined}
      onClick={handleClick}
      className={`ml-auto inline-flex shrink-0 items-center justify-center rounded-kcp border border-border bg-surface px-1 ${
        busy
          ? 'cursor-not-allowed text-ink-soft'
          : 'text-ink hover:bg-surface-alt'
      } ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <RefreshCw size={14} strokeWidth={2} aria-hidden />
    </button>
  );
}
