// When the entry toast near the launcher shows, following the entry toast and launcher
// attention ADR (ADR-0063). It decides once per document. The wait of
// ENTRY_TOAST_DELAY_MS starts only after the plan load, the onboarding read, the worker
// handshake and the welcome decision have all settled, and only while the document is
// visible; a document that turns hidden during the wait starts it again when it is seen.
// When the wait ends the content is chosen once from the stores as they stand and kept,
// so a later hash change or plan edit never swaps the message or brings it back. A
// choice of nothing ends the schedule for the document.
//
// The hash is captured when the hook mounts, which is when the content script mounts,
// so the route offer can tell the page the document loaded on from a route the host
// navigated to later. A route offer speaks about the page on screen, so a route change
// while it shows hides it for good; nothing replaces it, and the plan kinds keep
// showing across a route change since they do not depend on the page. That hide leaves
// the toast the way its own controls do, so focus inside it moves to the launcher.
//
// Once shown, the toast hides after ENTRY_TOAST_VISIBLE_MS. A hold from the pointer or
// focus within it pauses that timer, and releasing the hold starts the full time again,
// the same as the panel toasts. Opening the panel, at any point, ends the schedule for
// good, so closing the panel never brings the toast back.

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { useStore } from 'zustand';
import {
  ENTRY_TOAST_DELAY_MS,
  ENTRY_TOAST_VISIBLE_MS,
  selectEntryToast,
  type EntryToastContent,
  type EntryToastInput,
} from '@/lib/onboarding/entryToast';
import { planStore } from '@/features/plans/planStore';
import { activePlanOf } from '@/features/plans/planStoreState';
import { uiStore } from '@/features/shell/uiStore';
import {
  readLocationHash,
  subscribeHashRoute,
} from '@/features/search/useHashRoute';
import { leaveEntryToast } from './leaveEntryToast';
import { onboardingStore } from './onboardingStore';

type Phase =
  | { stage: 'waiting' }
  | { stage: 'shown'; content: EntryToastContent }
  | { stage: 'done' };

const WAITING: Phase = { stage: 'waiting' };
const DONE: Phase = { stage: 'done' };

export interface EntryToastSchedule {
  /** What the toast shows now, or null while it waits and once it has gone. */
  content: EntryToastContent | null;
  /** Hides the toast for the rest of this document. */
  end: () => void;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}

function documentVisible(): boolean {
  return document.visibilityState === 'visible';
}

/** The choice's input read from the stores at the moment the wait ends. */
function currentInput(mountHash: string): EntryToastInput {
  const plans = planStore.getState();
  const plan = activePlanOf(plans);
  const onboarding = onboardingStore.getState();
  return {
    plan:
      plan === undefined ? null : { name: plan.name, entries: plan.entries },
    onboarding: onboarding.record,
    isOpen: uiStore.getState().isOpen,
    welcomeOpen: onboarding.welcomeOpen,
    documentSuppressed: onboarding.documentSuppressed,
    settled:
      plans.loaded &&
      onboarding.loaded &&
      onboarding.handshakeSettled &&
      onboarding.welcomeSettled,
    hash: { atMount: mountHash, atShow: readLocationHash() },
  };
}

export function useEntryToastSchedule(
  held: boolean,
  /** The toast's box, so a hide the host route causes can hand focus on. */
  boxRef: RefObject<HTMLElement | null>,
): EntryToastSchedule {
  const [phase, setPhase] = useState<Phase>(WAITING);
  const [mountHash] = useState(readLocationHash);
  const planLoaded = useStore(planStore, (state) => state.loaded);
  const onboardingLoaded = useStore(onboardingStore, (state) => state.loaded);
  const handshakeSettled = useStore(
    onboardingStore,
    (state) => state.handshakeSettled,
  );
  const welcomeSettled = useStore(
    onboardingStore,
    (state) => state.welcomeSettled,
  );
  const settled =
    planLoaded && onboardingLoaded && handshakeSettled && welcomeSettled;
  const visible = useSyncExternalStore(subscribeVisibility, documentVisible);

  // The first panel open ends the schedule, whatever stage it is in.
  useEffect(
    () =>
      uiStore.subscribe((state, previous) => {
        if (state.isOpen && !previous.isOpen) setPhase(DONE);
      }),
    [],
  );

  const waiting = phase.stage === 'waiting';
  useEffect(() => {
    if (!waiting || !settled || !visible) return undefined;
    const timer = setTimeout(() => {
      const content = selectEntryToast(currentInput(mountHash));
      setPhase(content === null ? DONE : { stage: 'shown', content });
    }, ENTRY_TOAST_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting, settled, visible, mountHash]);

  const routeShown = phase.stage === 'shown' && phase.content.kind === 'route';
  useEffect(() => {
    if (!routeShown) return undefined;
    // A popstate that left the hash as it was keeps the offer, since the page is the same.
    return subscribeHashRoute(() => {
      if (readLocationHash() === mountHash) return;
      leaveEntryToast(boxRef.current, () => {
        setPhase(DONE);
      });
    });
  }, [routeShown, mountHash, boxRef]);

  const shown = phase.stage === 'shown';
  useEffect(() => {
    if (!shown || held) return undefined;
    const timer = setTimeout(() => {
      setPhase(DONE);
    }, ENTRY_TOAST_VISIBLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shown, held]);

  return {
    content: phase.stage === 'shown' ? phase.content : null,
    end: () => {
      setPhase(DONE);
    },
  };
}
