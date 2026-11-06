// Opens the updates dialog on its own once a waiting request meets an idle moment
// (ADR-0060). A request comes from a run that left new review items; it opens only for
// the active plan, only while the overlay is open in edit, where the dialog's actions
// live, and only after the panel has stayed that way for a short settle, so the dialog
// never lands in the middle of a gesture that just ended. A request for a plan that is no
// longer active is dropped, since the switch runs its own check. The hook mounts once at
// the app root.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { uiStore } from '@/features/shell/uiStore';
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

  useEffect(() => {
    if (pending === null) {
      return undefined;
    }
    if (pending !== activePlanId) {
      revalidationStore.getState().clearPendingOpen();
      return undefined;
    }
    if (!editing) {
      return undefined;
    }
    const timer = setTimeout(openUpdatesDialog, IDLE_SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pending, activePlanId, editing]);
}
