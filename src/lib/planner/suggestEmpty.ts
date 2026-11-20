// Why a suggestion search has nothing to offer. A suggestion is worth offering only
// when it changes the plan: it adds a ticked course or moves a subject already in
// the plan to another section group. A timetable that keeps every plan subject
// where it is and adds nothing is the plan itself, so the dialog never offers it.
// The search always keeps the best timetable it finds, so a result with nothing to
// offer is one whose best timetable adds nothing; its left out list then says why
// each candidate stayed out. When there is no timetable at all, the ticked plan
// subjects could not all fit together, unless the node cap stopped the search
// before it reached one, which is named apart since narrowing the ticks is the way
// out. When no course outside the plan is ticked, the reason tells apart a tick
// list with nothing ticked from one whose ticked plan subjects already fit as they
// are, since the second shows ticks on screen. The interface names one reason for
// the whole result, from the tick list first and then from the left out reasons.

import type { SuggestResult, Suggestion } from './suggest';

export type SuggestEmptyReason =
  /** Every course of the result is already in the plan, and no move helps. */
  | 'allPlaced'
  /** The ticked subjects already in the plan cannot all fit together. */
  | 'planClash'
  /** The node cap stopped the search before it reached any timetable. */
  | 'truncated'
  /** Some course could be ticked, but the student ticked none. */
  | 'noneTicked'
  /** Only plan subjects are ticked, and the plan already fits them as it is. */
  | 'planFits'
  /** Every section of every ticked course is full or closed. */
  | 'seats'
  /** The open sections all clash with the plan, or with each other's exams. */
  | 'conflicts';

/** How many result courses outside the plan can be ticked, and how many are. */
export interface SuggestTickCounts {
  tickable: number;
  ticked: number;
}

/** Whether a suggestion adds a course or moves a plan subject to another group. */
export function changesPlan(suggestion: Suggestion): boolean {
  return suggestion.choices.some((choice) => !choice.current);
}

/** The reason a result has nothing to suggest, or null when it suggests something. */
export function suggestEmptyReason(
  result: SuggestResult,
  counts: SuggestTickCounts,
): SuggestEmptyReason | null {
  if (result.suggestions.some(changesPlan)) {
    return null;
  }
  const best = result.suggestions[0];
  if (best === undefined) {
    return result.truncated ? 'truncated' : 'planClash';
  }
  if (counts.tickable === 0) {
    return 'allPlaced';
  }
  if (counts.ticked === 0 || best.leftOut.length === 0) {
    return best.choices.length > 0 ? 'planFits' : 'noneTicked';
  }
  return best.leftOut.every(({ reason }) => reason.kind === 'seats')
    ? 'seats'
    : 'conflicts';
}
