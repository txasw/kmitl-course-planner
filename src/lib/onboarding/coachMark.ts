// Whether the selector coach mark shows, as a pure choice, following ADR-0072. The coach
// mark dims the host search page and points at the launcher, so a student who arrives on
// the search form notices the planner at once. It speaks on every visit of the selector
// route: when a document loads there, and again each time the host router makes the route
// active. A visit is the stretch of time the route stays active, so a dismissal holds
// until the student navigates away and comes back.
//
// It never shows before the reads and the first run decisions have settled, so it never
// judges the empty state before them; never while the panel or the welcome is open; never
// in a document the entry prompts stay quiet in, which found the welcome pending at load
// or opened the panel because the worker asked; and never on the local day the student
// chose not again today. Reading the hash never changes it (Section 4.6).

/** The path of the host search form route, without the leading hash. */
export const SELECTOR_ROUTE_PATH = '/teach_table_selector';

/** Whether a location hash names the host search form, with or without a query. */
export function isSelectorRoute(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryStart = raw.indexOf('?');
  const path = queryStart === -1 ? raw : raw.slice(0, queryStart);
  return path === SELECTOR_ROUTE_PATH || path === `${SELECTOR_ROUTE_PATH}/`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The calendar day of a moment in the device's own time zone, as YYYY-MM-DD. Not again
 * today means the student's today, so the day is local rather than UTC, and the string
 * form sorts in calendar order.
 */
export function localDayStamp(at: Date): string {
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export interface CoachMarkInput {
  /** The plan and onboarding reads, the worker handshake and the welcome decision have
   * all settled. */
  settled: boolean;
  /** The location hash as it stands. */
  hash: string;
  isOpen: boolean;
  welcomeOpen: boolean;
  /** True once this document found the welcome pending at load, showed it, or applied
   * an open the worker requested. */
  documentSuppressed: boolean;
  /** The stored day the student chose not again today, if any. */
  snoozedOn: string | undefined;
  /** Today's local day stamp. */
  today: string;
  /** The student dismissed the coach mark during the current visit of the route. */
  dismissedThisVisit: boolean;
}

// A stamp after today only exists when the clock moved back since it was written. The
// stored day only ever moves forward, so it is read the same way: as quiet through that
// day, which keeps the choice the student made rather than reopening it.
function snoozedThrough(snoozedOn: string | undefined, today: string): boolean {
  return snoozedOn !== undefined && snoozedOn >= today;
}

/** Whether the coach mark shows now. */
export function shouldShowCoachMark(input: CoachMarkInput): boolean {
  return (
    input.settled &&
    isSelectorRoute(input.hash) &&
    !input.isOpen &&
    !input.welcomeOpen &&
    !input.documentSuppressed &&
    !input.dismissedThisVisit &&
    !snoozedThrough(input.snoozedOn, input.today)
  );
}
