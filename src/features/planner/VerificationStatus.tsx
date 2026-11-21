// The verification status of the active plan, the quiet item at the end of the edit stats
// bar and in the preview toolbar outside the poster capture node. It states how current the
// plan data is and carries the one action that replays upstream data: an icon button that
// checks again, or a labelled retry when the last check reached none or only some of its
// source queries, so the unverified state of brief section 6.6 step 6 and its retry stay in
// reach in both modes. A retry is not a plan edit, so it belongs in preview too. While the
// plan has anything to review, a details action opens the updates dialog, switching to edit
// first, since the dialog's acknowledge and remove actions never enter the preview DOM. A
// check in edit that finds something new opens the dialog directly. The item is not a live
// region; a manual check settles through the status announcer (ADR-0060).
// On the phone status row the item folds to its tone glyph, so the row keeps to two lines: the
// status words are the glyph's accessible name and its tooltip, and a tap reveals them with the
// details and check actions in words (ADR-0049 amendment of 2026-11-21).

import { useStore } from 'zustand';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  List,
  RefreshCw,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { planDataDate } from '@/lib/planner/posterHonesty';
import { hasUpdateItems } from '@/lib/planner/updateReview';
import { FOCUS_RING } from '@/lib/ui/focus';
import { SMALL_ICON } from '@/lib/ui/icon';
import { TARGET_SIZE } from '@/lib/ui/target';
import { useActivePlan } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { checkPlanNow } from '@/features/plans/updatesNotice';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { StatusReveal } from './StatusReveal';
import { verificationText, type VerificationTone } from './verificationText';

const TONE_CLASS: Record<VerificationTone, string> = {
  checking: 'text-ink-soft',
  ok: 'text-ink-soft',
  changed: 'text-ink',
  warn: 'text-warn',
  none: 'text-ink-soft',
};

function toneIcon(tone: VerificationTone): ReactNode {
  switch (tone) {
    case 'checking':
      return (
        <RefreshCw
          {...SMALL_ICON}
          className="animate-spin motion-reduce:animate-none"
        />
      );
    case 'ok':
      return <CheckCircle2 {...SMALL_ICON} className="text-success" />;
    case 'changed':
      return <AlertCircle {...SMALL_ICON} className="text-warn" />;
    case 'warn':
      return <AlertTriangle {...SMALL_ICON} />;
    case 'none':
      return <CircleDashed {...SMALL_ICON} />;
  }
}

const BUTTON = `inline-flex items-center gap-1 rounded-kcp border border-border bg-surface px-2 py-0.5 text-ink hover:bg-surface-alt disabled:text-ink-soft ${TARGET_SIZE} ${FOCUS_RING}`;

const POPOVER_BUTTON = `inline-flex items-center gap-1.5 rounded-kcp border border-border bg-surface px-2 py-1 text-ink hover:bg-surface-alt disabled:text-ink-soft ${TARGET_SIZE} ${FOCUS_RING}`;

interface VerificationStatusProps {
  /** Fold the item to its tone glyph, the words and actions a tap away, for the phone row. */
  compact?: boolean;
}

export function VerificationStatus({
  compact = false,
}: VerificationStatusProps) {
  const { t } = useTranslation();
  const { send } = useSearchDeps();
  const activePlan = useActivePlan();
  const runs = useStore(revalidationStore, (state) => state.runs);

  if (activePlan === null || activePlan.entries.length === 0) {
    return null;
  }
  const run = runs[activePlan.id] ?? null;
  const status = verificationText(
    run,
    planDataDate(activePlan.entries),
    new Date(),
    t,
  );
  const checking = status.tone === 'checking';

  const handleCheck = (): void => {
    void checkPlanNow(activePlan, send);
  };
  const handleReview = (): void => {
    uiStore.getState().setViewMode('edit');
    revalidationStore.getState().setUpdatesOpen(true);
  };
  const reviewable = hasUpdateItems(activePlan.entries);

  if (compact) {
    return (
      <span data-verification={status.tone} className="inline-flex">
        <StatusReveal
          label={status.text}
          toneClass={TONE_CLASS[status.tone]}
          detail={
            <>
              <p
                className={`flex items-start gap-1.5 ${TONE_CLASS[status.tone]}`}
              >
                {toneIcon(status.tone)}
                <span>{status.text}</span>
              </p>
              <span className="flex flex-wrap gap-1.5">
                {reviewable ? (
                  <button
                    type="button"
                    onClick={handleReview}
                    className={POPOVER_BUTTON}
                  >
                    <List size={14} strokeWidth={2} aria-hidden />
                    {t('revalidation.detail')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={checking}
                  className={POPOVER_BUTTON}
                >
                  <RefreshCw size={14} strokeWidth={2} aria-hidden />
                  {t(
                    status.tone === 'warn'
                      ? 'action.retry'
                      : 'revalidation.checkAgain',
                  )}
                </button>
              </span>
            </>
          }
        >
          {toneIcon(status.tone)}
        </StatusReveal>
      </span>
    );
  }

  return (
    <span
      data-verification={status.tone}
      className="inline-flex flex-wrap items-center gap-1.5"
    >
      <span
        className={`inline-flex items-center gap-1 ${TONE_CLASS[status.tone]}`}
      >
        {toneIcon(status.tone)}
        {status.text}
      </span>
      {reviewable ? (
        <button type="button" onClick={handleReview} className={BUTTON}>
          <List size={12} strokeWidth={2} aria-hidden />
          {t('revalidation.detail')}
        </button>
      ) : null}
      {status.tone === 'warn' ? (
        <button type="button" onClick={handleCheck} className={BUTTON}>
          <RefreshCw size={12} strokeWidth={2} aria-hidden />
          {t('action.retry')}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          aria-label={t('revalidation.checkAgain')}
          title={t('revalidation.checkAgain')}
          className={`${BUTTON} justify-center px-1`}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
        </button>
      )}
    </span>
  );
}
