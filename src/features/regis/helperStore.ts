// The registration helper's memory for one visit (owner answer 5B): whether the student
// collapsed or hid it, the card or the list, the subject in focus, the last status the
// page showed for each subject, and the fill stop the student moved past by choosing
// another section, and the sentence its live region reads. A visit starts on each arrival
// on a helper page, which clears all of it, so the helper opens expanded every time.
// Nothing here is stored.

import { createStore } from 'zustand/vanilla';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import type { FillRun } from './fill/fillRun';

/** The ids the launcher and the card hand focus between. */
export const CARD_ID = 'kcp-regis-card';
export const COUNT_ID = 'kcp-regis-count';

export type HelperView = 'card' | 'list';

export interface HelperVisitState {
  /** Whether the visit's card may open: the first page reading came, or the wait ran out. */
  ready: boolean;
  collapsed: boolean;
  /** Hidden on this page, launcher and all, until the next visit. */
  hidden: boolean;
  view: HelperView;
  /** The subject in focus, or null to pick the first that needs action. */
  current: string | null;
  last: Readonly<Record<string, HelperStatus>>;
  /** The stopped run the student moved past, so its stop no longer names a status. */
  clearedStop: FillRun | null;
  /** The latest sentence for the helper's one live region, with a count so a repeat reads. */
  announcement: { text: string; seq: number };
}

const FRESH: HelperVisitState = {
  ready: false,
  collapsed: false,
  hidden: false,
  view: 'card',
  current: null,
  last: {},
  clearedStop: null,
  announcement: { text: '', seq: 0 },
};

export const helperStore = createStore<HelperVisitState>()(() => FRESH);

export function startVisit(): void {
  helperStore.setState(FRESH);
}

export function markReady(): void {
  if (!helperStore.getState().ready) helperStore.setState({ ready: true });
}

export function setCollapsed(collapsed: boolean): void {
  helperStore.setState({ collapsed });
}

export function hideHelper(): void {
  helperStore.setState({ hidden: true, collapsed: true });
}

export function setView(view: HelperView): void {
  helperStore.setState({ view });
}

/** Put a subject in focus, or null to let the run or the first that needs action lead. */
export function setCurrent(current: string | null): void {
  helperStore.setState({ current });
}

export function recordLast(last: Readonly<Record<string, HelperStatus>>): void {
  helperStore.setState({ last });
}

export function clearStop(run: FillRun): void {
  helperStore.setState({ clearedStop: run });
}

export function announce(text: string): void {
  const { seq } = helperStore.getState().announcement;
  helperStore.setState({ announcement: { text, seq: seq + 1 } });
}
