// Why a suggestion search has nothing to offer. The search always keeps the best
// timetable it finds, so a result with nothing to suggest is one whose best timetable
// chooses no ticked course; its left out list then says why each candidate stayed
// out. The interface names one reason for the whole result, from the tick list first
// and then from the left out reasons.

import type { SuggestResult } from './suggest';

export type SuggestEmptyReason =
  /** Every course of the result is already in the plan, so none can be ticked. */
  | 'allPlaced'
  /** Some course could be ticked, but the student ticked none. */
  | 'noneTicked'
  /** Every section of every ticked course is full or closed. */
  | 'seats'
  /** The open sections all clash with the plan, or with each other's exams. */
  | 'conflicts';

/** How many courses the tick list offers, and how many of them are ticked. */
export interface SuggestTickCounts {
  tickable: number;
  ticked: number;
}

/** The reason a result has nothing to suggest, or null when it suggests something. */
export function suggestEmptyReason(
  result: SuggestResult,
  counts: SuggestTickCounts,
): SuggestEmptyReason | null {
  const best = result.suggestions[0];
  if (best !== undefined && best.choices.length > 0) {
    return null;
  }
  if (counts.tickable === 0) {
    return 'allPlaced';
  }
  const leftOut = best?.leftOut ?? [];
  if (counts.ticked === 0 || leftOut.length === 0) {
    return 'noneTicked';
  }
  return leftOut.every(({ reason }) => reason.kind === 'seats')
    ? 'seats'
    : 'conflicts';
}
