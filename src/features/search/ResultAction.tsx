// The one action at the end of the summary bar. After a reload the bar is restored with
// no result in memory, so it offers ค้นหาอีกครั้ง, which runs the search it names as the
// student's own search and reuses the worker cache while that is still valid. Once a
// result exists it is an icon button that loads the results again, bypassing the cache,
// so the seats and closures on screen catch up on demand; that refresh runs in the
// background and leaves the disclosure as the student set it. Both are one element, so
// focus stays on it as the press turns one into the other, and it stays mounted while
// the query runs: aria-disabled then and described by the busy text beside it, rather
// than replaced by it. A changed result is visible in the catalog, so only a refresh that
// changed nothing confirms itself through a toast. The refresh icon carries a tooltip that
// names it and says when the data on screen was fetched, and that time also describes it.

import { useStore } from 'zustand';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
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
  /** When the data on screen was fetched, already localized, or null before a result. */
  dataTime: string | null;
  /** The id of the element that reads the data time, which describes the refresh. */
  dataTimeId: string;
}

const ACTION = `inline-flex shrink-0 items-center justify-center gap-1 rounded-kcp ${TARGET_SIZE} ${FOCUS_RING}`;
const BUSY = 'cursor-not-allowed text-ink-soft';
const IDLE = 'text-ink hover:bg-surface-alt';

export function ResultAction({
  statusId,
  dataTime,
  dataTimeId,
}: ResultActionProps) {
  const { t } = useTranslation();
  const { rerun, refreshResult } = useSearchActions(useSearchDeps());
  const status = useStore(searchStore, (state) => state.result.status);
  const busy = status === 'loading';
  const restored = status === 'idle';
  const refreshLabel = t('search.bar.refresh');

  const handleClick = (): void => {
    if (busy) return;
    if (restored) {
      void rerun();
      return;
    }
    void (async () => {
      if ((await refreshResult()) === 'unchanged') {
        toastStore.getState().show('success', t('toast.refreshUnchanged'));
      }
    })();
  };

  return (
    <Tooltip
      label={
        dataTime === null ? (
          refreshLabel
        ) : (
          <>
            <span className="block">{refreshLabel}</span>
            <span className="block text-ink-soft tabular-nums">{dataTime}</span>
          </>
        )
      }
      placement="bottom-end"
      disabled={restored}
    >
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-label={restored ? undefined : refreshLabel}
          aria-disabled={busy || undefined}
          aria-describedby={
            busy
              ? statusId
              : restored || dataTime === null
                ? undefined
                : dataTimeId
          }
          onClick={handleClick}
          className={`${ACTION} ${restored ? 'border border-border bg-surface px-2 text-sm' : 'px-1'} ${busy ? BUSY : IDLE}`}
        >
          {restored ? (
            <>
              <RotateCcw size={14} strokeWidth={2} aria-hidden />
              {t('search.bar.rerun')}
            </>
          ) : (
            <RefreshCw size={16} strokeWidth={2} aria-hidden />
          )}
        </button>
      )}
    </Tooltip>
  );
}
