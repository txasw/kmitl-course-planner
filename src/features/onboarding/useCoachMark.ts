// When the selector coach mark shows, following ADR-0072. The choice itself is the pure
// shouldShowCoachMark; this hook feeds it the host route, the stores, and the visit.
//
// A visit is the stretch of time the host search route stays active. The hook keeps one
// flag for it, whether the student dismissed the coach mark during the visit, and clears
// the flag when the route stops being active, so the next arrival speaks again. Opening
// the panel from the spotlit launcher also ends the visit's coach mark, so closing the
// panel on the same page does not bring it back. Both are adjustments of state from what
// rendered, so no effect runs for them.
//
// The day is read at render, so a page left open past midnight compares against the new
// day on its next visit. The open state is mirrored into the onboarding store, where the
// launcher ring and the entry toast read it.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import {
  isSelectorRoute,
  localDayStamp,
  shouldShowCoachMark,
} from '@/lib/onboarding/coachMark';
import type { OnboardingRepository } from '@/lib/storage/onboarding';
import { uiStore } from '@/features/shell/uiStore';
import {
  readLocationHash,
  subscribeHashRoute,
} from '@/features/search/useHashRoute';
import { onboardingStore } from './onboardingStore';
import { recordCoachMarkSnooze } from './recordOnboardingMoment';

export interface CoachMarkControls {
  open: boolean;
  /** Hides the coach mark for the rest of this visit of the route. */
  dismiss: () => void;
  /** Hides it and keeps it away for the rest of the local day. */
  snooze: () => void;
}

export function useCoachMark(
  record: Pick<OnboardingRepository, 'patch'>,
): CoachMarkControls {
  const hash = useSyncExternalStore(
    subscribeHashRoute,
    readLocationHash,
    readLocationHash,
  );
  const onRoute = isSelectorRoute(hash);
  const [dismissed, setDismissed] = useState(false);
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const settled = useStore(
    onboardingStore,
    (state) => state.loaded && state.handshakeSettled && state.welcomeSettled,
  );
  const welcomeOpen = useStore(onboardingStore, (state) => state.welcomeOpen);
  const documentSuppressed = useStore(
    onboardingStore,
    (state) => state.documentSuppressed,
  );
  const snoozedOn = useStore(
    onboardingStore,
    (state) => state.record.coachMarkSnoozedOn,
  );

  if (!onRoute && dismissed) setDismissed(false);
  if (onRoute && isOpen && !dismissed) setDismissed(true);

  const open = shouldShowCoachMark({
    settled,
    hash,
    isOpen,
    welcomeOpen,
    documentSuppressed,
    snoozedOn,
    today: localDayStamp(new Date()),
    dismissedThisVisit: dismissed,
  });

  useEffect(() => {
    onboardingStore.getState().setCoachMarkOpen(open);
  }, [open]);

  useEffect(
    () => () => {
      onboardingStore.getState().setCoachMarkOpen(false);
    },
    [],
  );

  return {
    open,
    dismiss: () => {
      setDismissed(true);
    },
    snooze: () => {
      recordCoachMarkSnooze(record, localDayStamp(new Date()));
      setDismissed(true);
    },
  };
}
