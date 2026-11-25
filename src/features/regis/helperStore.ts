// The registration helper's memory for one visit (owner answer 5B): whether the student
// collapsed or hid it, the card or the list, the subject in focus, the last status the
// page showed for each subject, and the fill stop the student moved past by choosing
// another section, and the sentence its live region reads. A visit starts on each arrival
// on a helper page, which clears all of it. The card opens expanded on a wide screen, every
// visit (owner answer 5B), and starts collapsed to the launcher on a narrow one, so a phone
// shows the host page first; there a later visit follows the open or collapse the student
// chose on purpose earlier in this document. Nothing here is stored.

import { createStore } from 'zustand/vanilla';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import type { FillRun } from './fill/fillRun';

/** The ids the launcher and the card hand focus between. */
export const CARD_ID = 'kcp-regis-card';
export const COUNT_ID = 'kcp-regis-count';
/** The Stop of a running fill, which a press of the launcher during a run hands focus to. */
export const STOP_ID = 'kcp-regis-stop';

export type HelperView = 'card' | 'list';

export interface HelperVisitState {
  /** Whether the visit's card may open: the first page reading came, or the wait ran out. */
  ready: boolean;
  collapsed: boolean;
  /**
   * The student's own last open or collapsed choice in this document, which a new visit
   * on a narrow screen follows, or null before any. Unlike the rest it outlives a visit.
   */
  chosen: boolean | null;
  /** Hidden on this page, launcher and all, until the next visit. */
  hidden: boolean;
  view: HelperView;
  /** The subject in focus, or null to pick the first that needs action. */
  current: string | null;
  last: Readonly<Record<string, HelperStatus>>;
  /** The stopped run the student moved past, so its stop no longer names a status. */
  clearedStop: FillRun | null;
  /**
   * The plan of the page term the student picked in the helper on this visit, or null to
   * follow the default. It never changes the planner's active plan.
   */
  planId: string | null;
  /** The latest sentence for the helper's one live region, with a count so a repeat reads. */
  announcement: { text: string; seq: number };
}

const FRESH: HelperVisitState = {
  ready: false,
  collapsed: false,
  chosen: null,
  hidden: false,
  view: 'card',
  current: null,
  last: {},
  clearedStop: null,
  planId: null,
  announcement: { text: '', seq: 0 },
};

export const helperStore = createStore<HelperVisitState>()(() => FRESH);

/**
 * Start a visit: open on a wide screen, and on a narrow one collapsed unless the student
 * opened it on purpose earlier in this document.
 */
export function startVisit(narrow = false): void {
  const { chosen } = helperStore.getState();
  helperStore.setState({
    ...FRESH,
    chosen,
    collapsed: narrow && (chosen ?? true),
  });
}

export function markReady(): void {
  if (!helperStore.getState().ready) helperStore.setState({ ready: true });
}

export function setCollapsed(collapsed: boolean): void {
  helperStore.setState({ collapsed });
}

/** Open or collapse the card on the student's press, remembered for later visits. */
export function chooseCollapsed(collapsed: boolean): void {
  helperStore.setState({ collapsed, chosen: collapsed });
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

/** Show another plan of the page term; the focus and last statuses start over for it. */
export function pickHelperPlanId(planId: string): void {
  helperStore.setState({ planId, current: null, last: {}, clearedStop: null });
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
