// Opens the updates dialog on its own once a waiting request meets an idle moment
// (ADR-0060). A request comes from a run that left new review items; it opens only for
// the active plan, only while the overlay is open in edit, where the dialog's actions
// live, and only while nothing holds the student's attention: no drag in flight, no
// popover, menu, sheet, or dialog open, no focus inside the search form, and no catalog
// over the grid: neither the medium tier's sheet nor, below 640 px, the catalog pane, which
// hides the grid the dialog points to. The panel must stay idle for a short settle, so the
// dialog never lands on a gesture that just ended, and any busy moment restarts it. A
// request for a plan that is no longer active is dropped, since the switch runs its own
// check. The hook mounts once at the app root.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { dragStore, selectDragging } from '@/features/planner/dragStore';
import {
  attentionStore,
  selectAttentionHeld,
} from '@/features/shell/attentionStore';
import { useMobilePane } from '@/features/shell/mobilePane';
import { uiStore } from '@/features/shell/uiStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';
import { openUpdatesDialog } from './updatesNotice';

/** How long the panel must stay idle before the dialog opens, in milliseconds. */
export const IDLE_SETTLE_MS = 600;

export function useUpdatesAutoOpen(): void {
  const pending = useStore(revalidationStore, (state) => state.pendingOpen);
  const activePlanId = useStore(planStore, (state) => state.activePlanId);
  const editing = useStore(
    uiStore,
    (state) => state.isOpen && state.viewMode === 'edit',
  );
  const dragging = useStore(dragStore, selectDragging);
  const attentionHeld = useStore(attentionStore, selectAttentionHeld);
  const catalogSheetOpen = useStore(uiStore, (state) => state.sheetOpen);
  const tier = useLayoutTier();
  const pane = useMobilePane();
  const catalogOverGrid =
    (tier === 'medium' && catalogSheetOpen) ||
    (tier === 'compact' && pane === 'catalog');
  const busy = dragging || attentionHeld || catalogOverGrid;

  useEffect(() => {
    if (pending === null) {
      return undefined;
    }
    if (pending !== activePlanId) {
      revalidationStore.getState().clearPendingOpen();
      return undefined;
    }
    if (!editing || busy) {
      return undefined;
    }
    const timer = setTimeout(openUpdatesDialog, IDLE_SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pending, activePlanId, editing, busy]);
}
