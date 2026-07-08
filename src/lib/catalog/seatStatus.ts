// Derive the seat status a catalog row shows. Closed takes priority, then full,
// then open. A section is full when the enrolled count is the full sentinel or,
// for a capped section, when no queue slots remain. An uncapped section (limit
// null, the API sends "-") is never full and reports no remaining count.

import type { Section } from '../domain/types';

export type SeatStatus =
  | { kind: 'closed' }
  | { kind: 'full' }
  | { kind: 'open'; remaining: number | null };

export function computeSeatStatus(section: Section): SeatStatus {
  if (section.isClosed) {
    return { kind: 'closed' };
  }
  const { seats } = section;
  const full =
    seats.enrolled === 'full' || (seats.limit !== null && seats.queueLeft <= 0);
  if (full) {
    return { kind: 'full' };
  }
  return {
    kind: 'open',
    remaining: seats.limit === null ? null : seats.queueLeft,
  };
}

/** Whether a section can be dragged or added: open and not closed. */
export function isSelectable(section: Section): boolean {
  return computeSeatStatus(section).kind === 'open';
}
