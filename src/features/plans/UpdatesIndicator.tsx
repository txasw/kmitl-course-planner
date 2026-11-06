// The updates indicator of ADR-0060: while the active plan has anything to review, a warn
// chip names how many items the updates dialog lists and reopens the dialog. It keeps an
// unread change one action away after the student chose to review it later or closed the
// dialog. It renders nothing once every change is acknowledged and every section no longer
// listed is removed, since an acknowledged missing section stays a dialog item. It sits at
// the right of the plan view tabs on the medium and wide tiers and at the top of the plan
// pane below 640 px. It is not a live region: StatusAnnouncer reads its first appearance, so
// the count is spoken once rather than on every render. The dialog returns focus here when
// it closes. The panel renders the indicator in edit only, where the dialog lives.

import { useStore } from 'zustand';
import { AlertCircle } from 'lucide-react';
import { fillTemplate } from '@/lib/i18n/template';
import { countUpdateItems } from '@/lib/planner/updateReview';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { useTranslation } from '@/features/shell/useTranslation';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';

export function UpdatesIndicator() {
  const { t } = useTranslation();
  const count = useStore(planStore, (state) => countUpdateItems(state.entries));

  if (count === 0) {
    return null;
  }

  const handleOpen = (): void => {
    revalidationStore.getState().setUpdatesOpen(true);
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`inline-flex shrink-0 items-center gap-1 self-center rounded-full border border-warn bg-surface px-2 py-0.5 text-xs text-ink hover:bg-warn-soft ${TARGET_HEIGHT} ${FOCUS_RING}`}
    >
      <AlertCircle
        size={14}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-warn"
      />
      {fillTemplate(t('updates.indicator'), { count })}
    </button>
  );
}
