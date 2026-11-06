// The updates dialog of ADR-0060, the one surface where the student reviews what a check
// changed in the active plan. Reconcile already applied the upstream data, so the dialog
// asks for an acknowledgement rather than an approval: it lists each entry with an open
// review, grouped from the most urgent, with the old and new values, and the entries with
// nothing to review in one collapsed group. The footer acknowledges every item, closes for
// later, or runs the check again. Closing any other way, by the close button, the scrim,
// or Escape, is the same as later, which marks the items shown and keeps their reviews.
// Each item can be shown on the timetable, and a section no longer listed can be removed
// from the plan with undo, its item staying in the list as removed meanwhile.
//
// It is a centred dialog from 640 px and a full height bottom sheet below, holding the
// same body. Both portal out of any live region, contain focus, and return it to the
// opener; focus starts on the acknowledgement, the likely next step. The dialog opens only
// in edit, where its actions live, so no mutating control enters the preview DOM.

import { useEffect, useId, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { BottomSheet } from '@/components/BottomSheet';
import { ModalDialog } from '@/components/ModalDialog';
import { snapshotToSection } from '@/lib/domain/plan';
import { planConflicts } from '@/lib/planner/planConflicts';
import { planExamConflicts } from '@/lib/planner/examOverlap';
import {
  buildUpdateReview,
  withRemovedItems,
  type UpdateItem,
} from '@/lib/planner/updateReview';
import { locateSection } from '@/features/planner/locateSection';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { rootOf } from '@/features/shell/useFocusTrap';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import { useTranslation } from '@/features/shell/useTranslation';
import { planStore } from './planStore';
import { UnchangedGroup, UpdateGroupList } from './UpdateGroupList';
import { UpdateItemActions } from './UpdateItemActions';
import { UpdatesFooter } from './UpdatesFooter';
import { useReviewRemoval } from './useReviewRemoval';

interface UpdatesDialogProps {
  onClose: () => void;
}

export function UpdatesDialog({ onClose }: UpdatesDialogProps) {
  const { t, language } = useTranslation();
  const tier = useLayoutTier();
  const entries = useStore(planStore, (state) => state.entries);
  const reducedMotion = usePrefersReducedMotion();
  const acknowledgeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyId = useId();

  const review = useMemo(() => {
    const sections = entries.map((entry) => snapshotToSection(entry.snapshot));
    return buildUpdateReview({
      entries,
      timeConflicts: planConflicts(sections),
      examConflicts: planExamConflicts(sections),
    });
  }, [entries]);
  const liveItems = review.groups.flatMap((group) => group.items);
  const itemIds = liveItems.map((item) => item.entry.teachTableId);
  const removal = useReviewRemoval(bodyRef, liveItems, acknowledgeRef);
  const { groups, removedIds } = withRemovedItems(
    review.groups,
    removal.removed,
    entries,
  );
  const empty = groups.length === 0;

  // A check that returned every value to what the student last saw leaves nothing to
  // review, so the dialog closes rather than stand open and empty.
  useEffect(() => {
    if (empty) {
      onClose();
    }
  }, [empty, onClose]);

  if (empty) {
    return null;
  }

  const handleLater = (): void => {
    planStore.getState().markNotified(itemIds);
    onClose();
  };

  const handleShow = (item: UpdateItem): void => {
    const root = bodyRef.current === null ? null : rootOf(bodyRef.current);
    planStore.getState().markNotified(itemIds);
    uiStore.getState().setPlanView('timetable');
    onClose();
    // Wait for the dialog to unmount and the timetable to render, so the block takes focus
    // after the dialog has handed it back to its opener.
    requestAnimationFrame(() => {
      if (root !== null) {
        locateSection(root, item.entry.teachTableId, reducedMotion);
      }
    });
  };

  const handleAcknowledgeAll = (): void => {
    const { acknowledge } = planStore.getState();
    for (const id of itemIds) {
      acknowledge(id);
    }
    toastStore.getState().show('success', t('updates.toast.done'));
    onClose();
  };

  const body = (
    <div ref={bodyRef} className="flex flex-col gap-4">
      <p id={bodyId} className="text-ink-soft">
        {t('updates.body')}
      </p>
      <UpdateGroupList
        groups={groups}
        locale={language}
        t={t}
        renderActions={(item) => {
          const id = item.entry.teachTableId;
          return (
            <UpdateItemActions
              item={item}
              t={t}
              removed={removedIds.has(id)}
              canUndo={removal.canUndo(id)}
              onShow={handleShow}
              onRemove={removal.remove}
              onUndo={removal.undo}
            />
          );
        }}
      />
      {review.unchanged.length > 0 ? (
        <UnchangedGroup entries={review.unchanged} locale={language} t={t} />
      ) : null}
    </div>
  );

  const surface = {
    title: t('updates.title'),
    closeLabel: t('action.close'),
    onClose: handleLater,
    footer: (
      <UpdatesFooter
        t={t}
        onLater={handleLater}
        onAcknowledgeAll={handleAcknowledgeAll}
        acknowledgeRef={acknowledgeRef}
      />
    ),
    initialFocusRef: acknowledgeRef,
    describedBy: bodyId,
  };

  return tier === 'compact' ? (
    <BottomSheet {...surface} fullHeight>
      <div className="pt-2">{body}</div>
    </BottomSheet>
  ) : (
    <ModalDialog {...surface} width="medium">
      {body}
    </ModalDialog>
  );
}
