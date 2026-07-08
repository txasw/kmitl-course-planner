// Derive the seat status a catalog row shows. Closed takes priority, then full,
// then open. Fullness comes from the authoritative signal: the API sends the
// count as the literal "เต็ม/Full" when full and a number when seats remain, so
// the enrolled sentinel decides, with an enrolled reaches limit guard as a
// backstop for a capped section. queue_left is a waitlist metric, not remaining
// seats, so it is not used. Remaining is limit minus enrolled; an uncapped
// section (limit null, the API sends "-") reports no remaining count.

import type { Section } from '../domain/types';

export type SeatStatus =
  | { kind: 'closed' }
  | { kind: 'full' }
  | { kind: 'open'; remaining: number | null };

export function computeSeatStatus(section: Section): SeatStatus {
  if (section.isClosed) {
    return { kind: 'closed' };
  }
  const { limit, enrolled } = section.seats;
  if (enrolled === 'full') {
    return { kind: 'full' };
  }
  if (limit !== null && enrolled >= limit) {
    return { kind: 'full' };
  }
  if (limit === null) {
    return { kind: 'open', remaining: null };
  }
  return { kind: 'open', remaining: Math.max(0, limit - enrolled) };
}

/** Whether a section can be dragged or added: open and not closed. */
export function isSelectable(section: Section): boolean {
  return computeSeatStatus(section).kind === 'open';
}
