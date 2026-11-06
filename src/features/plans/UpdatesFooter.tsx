// The pinned footer of the updates dialog. The acknowledgement is the primary action and
// the dialog's landing point, review later is the quiet alternative, and the check again
// link at the start runs a manual check of the active plan, the dialog's sync action. The
// link reads as checking and stays disabled while a check of the plan is running, so a
// second press never queues an overlapping run.

import type { RefObject } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useActivePlan } from './planStore';
import { checkPlanNow } from './updatesNotice';
import { useActiveRun } from './revalidationStore';

const SECONDARY_BUTTON = `rounded-kcp border border-border bg-surface px-3 py-1.5 text-sm text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`;

const PRIMARY_BUTTON = `rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`;

interface UpdatesFooterProps {
  t: Translate;
  onLater: () => void;
  onAcknowledgeAll: () => void;
  /** The acknowledgement, which takes focus when the dialog opens. */
  acknowledgeRef: RefObject<HTMLButtonElement | null>;
}

export function UpdatesFooter({
  t,
  onLater,
  onAcknowledgeAll,
  acknowledgeRef,
}: UpdatesFooterProps) {
  const { send } = useSearchDeps();
  const activePlan = useActivePlan();
  const checking = useActiveRun()?.status === 'running';

  const handleRecheck = (): void => {
    if (activePlan === null) return;
    void checkPlanNow(activePlan, send);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleRecheck}
        disabled={checking}
        className={`inline-flex items-center gap-1 rounded-kcp-inner text-sm text-primary-strong underline underline-offset-2 disabled:text-ink-soft disabled:no-underline ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        <RefreshCw
          size={14}
          strokeWidth={2}
          aria-hidden
          className={checking ? 'animate-spin motion-reduce:animate-none' : ''}
        />
        {checking ? t('revalidation.checking') : t('updates.recheck')}
      </button>
      <span className="ml-auto flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onLater} className={SECONDARY_BUTTON}>
          {t('updates.later')}
        </button>
        <button
          ref={acknowledgeRef}
          type="button"
          onClick={onAcknowledgeAll}
          className={PRIMARY_BUTTON}
        >
          {t('updates.acknowledgeAll')}
        </button>
      </span>
    </div>
  );
}
