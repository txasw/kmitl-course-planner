// The pre share notice in the preview chrome, outside the poster capture node. The poster
// carries no verification badges (ADR-0055), so before the user shares an image this slim row
// states how many entries changed or were not found at the last check. Its one action leaves
// preview for edit and then opens the updates dialog, so the review happens where the
// acknowledge and remove actions live and no mutating control enters the preview DOM. It
// never blocks an export: the sharing actions stay available beside it.

import { useStore } from 'zustand';
import { AlertCircle, List } from 'lucide-react';
import { fillTemplate } from '@/lib/i18n/template';
import { reviewBeforeShareCount } from '@/lib/planner/posterHonesty';
import { hasUpdateItems } from '@/lib/planner/updateReview';
import { FOCUS_RING } from '@/lib/ui/focus';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';

export function PreShareNotice() {
  const { t } = useTranslation();
  const entries = useStore(planStore, (state) => state.entries);
  const count = reviewBeforeShareCount(entries);

  if (count === 0) {
    return null;
  }

  const handleReview = () => {
    uiStore.getState().setViewMode('edit');
    // The dialog lists the entries' open reviews, which outlive the run that found them, so
    // it has items whenever an entry still asks for review, even after an offline check.
    // The guard keeps a flag from being left open with nothing to list.
    if (hasUpdateItems(entries)) {
      revalidationStore.getState().setUpdatesOpen(true);
    }
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-kcp border border-warn bg-warn-soft px-2 py-1 text-xs text-ink">
      <AlertCircle
        size={14}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-warn"
      />
      <span className="min-w-0 flex-1">
        {fillTemplate(t('preview.preShare.notice'), { count })}
      </span>
      <button
        type="button"
        onClick={handleReview}
        className={`inline-flex min-h-6 shrink-0 items-center gap-1 rounded-kcp border border-border bg-surface px-2 py-0.5 text-ink hover:bg-surface-alt pointer-coarse:min-h-11 ${FOCUS_RING}`}
      >
        <List size={12} strokeWidth={2} aria-hidden />
        {t('preview.preShare.review')}
      </button>
    </div>
  );
}
