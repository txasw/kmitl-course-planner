// The registration helper's status for each planned subject, as one pure derivation of
// what the read only observer saw on the page (ADR-0077) and what the student's own fill
// run reports (ADR-0078). There are no hand marks: a subject is added when the page lists
// it, and the helper never claims more than the page shows. While the page cannot be
// read, each subject keeps the last status the page showed in this visit, marked stale.

import type { Checklist, RowState } from './checklist';
import type { StopReason } from './fillPlan';

export const HELPER_STATUSES = [
  'todo',
  'adding',
  'added',
  'other',
  'cond',
  'full',
  'refused',
  'clash',
  'sent',
] as const;
export type HelperStatus = (typeof HELPER_STATUSES)[number];

export type StatusTone = 'neutral' | 'busy' | 'success' | 'warn' | 'danger';

export const STATUS_TONE: Readonly<Record<HelperStatus, StatusTone>> = {
  todo: 'neutral',
  adding: 'busy',
  added: 'success',
  other: 'warn',
  cond: 'warn',
  full: 'danger',
  refused: 'danger',
  clash: 'danger',
  sent: 'neutral',
};

/** Statuses the page shows as settled: the subject is on the list in some group. */
export function isDone(status: HelperStatus): boolean {
  return status === 'added' || status === 'other' || status === 'cond';
}

/** Statuses that still ask something of the student: to add it, or to pick again. */
export function needsAction(status: HelperStatus): boolean {
  return STATUS_TONE[status] === 'danger' || status === 'todo';
}

/** What the page reading of a row stands for in the helper. */
const PAGE_STATUS: Readonly<Record<RowState, HelperStatus>> = {
  notDone: 'todo',
  termMismatch: 'todo',
  added: 'added',
  addedOther: 'other',
  conditional: 'cond',
  refused: 'refused',
  submitted: 'sent',
  granted: 'sent',
  notGranted: 'sent',
  notSubmitted: 'sent',
};

/** The fill stops that are the page turning a subject down, and how the helper names them. */
const STOP_STATUS: Partial<Readonly<Record<StopReason, HelperStatus>>> = {
  full: 'full',
  refused: 'refused',
  hostClash: 'clash',
  kcpClash: 'clash',
};

export interface HelperInput {
  checklist: Checklist;
  /** Whether the page cannot be read now, so the last statuses stand. */
  stale: boolean;
  /** The last status each subject had while the page could be read, in this visit. */
  last: Readonly<Record<string, HelperStatus>>;
  /** The subject a fill run is adding now, or null. */
  adding: string | null;
  /** The stop of the last fill run the student has not moved past, or null. */
  stop: { subjectId: string; reason: StopReason } | null;
}

export interface HelperStatuses {
  statuses: Readonly<Record<string, HelperStatus>>;
  /** Whether the page shows the submitted list, which every subject then reads as. */
  sent: boolean;
}

export function deriveHelperStatuses(input: HelperInput): HelperStatuses {
  const { checklist, stale, last, adding, stop } = input;
  const sent = checklist.rows.some((row) => PAGE_STATUS[row.state] === 'sent');
  const statuses: Record<string, HelperStatus> = {};
  for (const row of checklist.rows) {
    const id = row.subjectId;
    const page = PAGE_STATUS[row.state];
    const stopped =
      stop?.subjectId === id ? (STOP_STATUS[stop.reason] ?? 'todo') : 'todo';
    statuses[id] = sent
      ? 'sent'
      : adding === id
        ? 'adding'
        : stale
          ? (last[id] ?? 'todo')
          : page === 'todo'
            ? stopped
            : page;
  }
  return { statuses, sent };
}

/** How many subjects the page shows settled. */
export function doneCount(statuses: Readonly<Record<string, HelperStatus>>) {
  return Object.values(statuses).filter(isDone).length;
}

/** Whether any subject is turned down, so the collapsed launcher asks for a look. */
export function needsLook(
  statuses: Readonly<Record<string, HelperStatus>>,
): boolean {
  return Object.values(statuses).some(
    (status) => STATUS_TONE[status] === 'danger',
  );
}

/** The subject in focus on open: the first in plan order that still needs action. */
export function pickCurrent(
  order: readonly string[],
  statuses: Readonly<Record<string, HelperStatus>>,
): string | null {
  return (
    order.find((id) => needsAction(statuses[id] ?? 'todo')) ?? order[0] ?? null
  );
}

/**
 * The subject in focus once the current one settles: the next after it in plan order that
 * still needs action, wrapping round, or the current one when none does.
 */
export function advanceCurrent(
  order: readonly string[],
  statuses: Readonly<Record<string, HelperStatus>>,
  current: string,
): string {
  if (!isDone(statuses[current] ?? 'todo')) return current;
  const at = order.indexOf(current);
  const rotated = [...order.slice(at + 1), ...order.slice(0, at)];
  return rotated.find((id) => needsAction(statuses[id] ?? 'todo')) ?? current;
}

/**
 * The subject to pin in focus once the one in focus settles on the page, or null to leave
 * the focus as it is. While a run adds with no subject pinned, the run leads the focus, so
 * nothing is pinned then: pinning the next subject that needs action could pick one the
 * run does not name, such as a refused subject between two it adds, and the grade dialog
 * of the subject it adds next would then find its condition off screen.
 */
export function focusOnSettle(input: {
  order: readonly string[];
  statuses: Readonly<Record<string, HelperStatus>>;
  /** The subject in focus now, or null. */
  current: string | null;
  /** That subject's status at the previous reading, or undefined when it had none. */
  was: HelperStatus | undefined;
  /** Whether a run is adding while no subject is pinned. */
  runLeads: boolean;
}): string | null {
  const { order, statuses, current, was, runLeads } = input;
  if (runLeads || current === null || was === undefined || isDone(was)) {
    return null;
  }
  const next = advanceCurrent(order, statuses, current);
  return next === current ? null : next;
}

/**
 * The subjects Add all for me names, in plan order: those not added and not turned down.
 * A subject the page refused, or stopped on as full or as a clash, waits for the student's
 * own choice of another section, so pressing Add all again never stops on it a second time.
 */
export function stillToAdd(
  order: readonly string[],
  statuses: Readonly<Record<string, HelperStatus>>,
): string[] {
  return order.filter((id) => (statuses[id] ?? 'todo') === 'todo');
}

/** Why add for me cannot run for a subject still to add, first reason first. */
export type AddBlock =
  | 'otherPage'
  | 'checking'
  | 'unavailable'
  | 'off'
  | 'preparing'
  | 'noKit'
  | 'stale'
  | 'termMismatch'
  | 'notInStep'
  | 'busy';

export interface AddFacts {
  /**
   * Whether the page is pre registration, the one page fill acts on. Every other page,
   * regular registration included, never runs the host check, so it is read first and no
   * other reason, the host check's included, can stand in for it there.
   */
  onPage: boolean;
  /** Whether fill can act on this page: a tested build and a plan to follow. */
  available: boolean;
  /** Whether the host check is still reading a build KCP has not seen before. */
  checking: boolean;
  /** Whether the student switched fill off. */
  off: boolean;
  /** Whether the prepare action is reading the plan's subjects now. */
  preparing: boolean;
  /** Whether the kit gives the subject a fill target. */
  target: boolean;
  stale: boolean;
  termMismatch: boolean;
  /** Whether the page shows the choose subjects step. */
  inStep: boolean;
  /** Whether a run is active for another subject. */
  busy: boolean;
}

export function addForMeBlock(facts: AddFacts): AddBlock | null {
  if (!facts.onPage) return 'otherPage';
  if (!facts.available) return facts.checking ? 'checking' : 'unavailable';
  if (facts.off) return 'off';
  if (facts.preparing) return 'preparing';
  if (!facts.target) return 'noKit';
  if (facts.stale) return 'stale';
  if (facts.termMismatch) return 'termMismatch';
  if (!facts.inStep) return 'notInStep';
  if (facts.busy) return 'busy';
  return null;
}
