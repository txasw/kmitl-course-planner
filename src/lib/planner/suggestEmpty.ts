// Why a suggestion search has nothing to offer. The search always keeps the best
// timetable it finds, so a result with nothing to suggest is one whose best timetable
// chooses no curriculum course; its left out list then says why each candidate stayed
// out. The interface names one reason for the whole result, from the left out reasons.

import type { SuggestResult } from './suggest';

export type SuggestEmptyReason =
  /** Every curriculum course of the result is already in the plan. */
  | 'allPlaced'
  /** Every section of every remaining curriculum course is full or closed. */
  | 'seats'
  /** The open sections all clash with the plan, or with each other's exams. */
  | 'conflicts';

/** The reason a result has nothing to suggest, or null when it suggests something. */
export function suggestEmptyReason(
  result: SuggestResult,
): SuggestEmptyReason | null {
  const best = result.suggestions[0];
  if (best !== undefined && best.choices.length > 0) {
    return null;
  }
  const leftOut = best?.leftOut ?? [];
  if (leftOut.length === 0) {
    return 'allPlaced';
  }
  return leftOut.every(({ reason }) => reason.kind === 'seats')
    ? 'seats'
    : 'conflicts';
}
