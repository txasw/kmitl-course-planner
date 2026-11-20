// When the product tour opens on its own, following ADR-0074. The choice itself is the
// pure shouldStartTour; this hook feeds it the stores and waits out a short settle, so
// the tour never lands on a panel still laying out its first frame, such as the one the
// welcome's Start planning just opened, and any change of the inputs restarts the wait.
// A dialog, sheet, menu, or popover counts as holding the panel through the attention
// store, so the tour waits for the updates dialog that can open on its own with the
// panel, and the updates dialog in turn waits for the tour, which counts as a surface
// while it is open.
//
// A tour the panel's close cuts short, by the close control or a back gesture, ends with
// the panel and records nothing, so it is due again on the next page load.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { shouldStartTour, TOUR_START_DELAY_MS } from '@/lib/onboarding/tour';
import { attentionStore } from '@/features/shell/attentionStore';
import { uiStore } from '@/features/shell/uiStore';
import { onboardingStore } from './onboardingStore';

export function useProductTourStart(): void {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const editing = useStore(
    uiStore,
    (state) => state.isOpen && state.viewMode === 'edit',
  );
  const surfaceOpen = useStore(
    attentionStore,
    (state) => state.openSurfaces > 0,
  );
  const loaded = useStore(onboardingStore, (state) => state.loaded);
  const welcomeOpen = useStore(onboardingStore, (state) => state.welcomeOpen);
  const seenVersion = useStore(
    onboardingStore,
    (state) => state.record.tourSeen?.version,
  );
  const tourOpen = useStore(onboardingStore, (state) => state.tourOpen);
  const startedThisDocument = useStore(
    onboardingStore,
    (state) => state.tourStarted,
  );

  useEffect(() => {
    if (!isOpen && tourOpen) onboardingStore.getState().endTour();
  }, [isOpen, tourOpen]);

  const due = shouldStartTour({
    loaded,
    editing,
    welcomeOpen,
    surfaceOpen,
    seenVersion,
    startedThisDocument,
  });

  useEffect(() => {
    if (!due) return undefined;
    const timer = setTimeout(() => {
      onboardingStore.getState().startTour();
    }, TOUR_START_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [due]);
}
