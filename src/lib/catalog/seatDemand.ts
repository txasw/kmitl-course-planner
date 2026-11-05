// The one seat summary every surface formats seats from, so a catalog row and a placed
// block cannot drift into two conventions (remaining seats against enrolled over
// limit). It sits on top of computeSeatStatus, which stays the authority for closed,
// full, and open, and splits open into a capped and an uncapped state because the
// visible line differs: a capped section reads its remaining count out of the limit,
// an uncapped one (the API sends the limit "-") has no count to give.
//
// Oversubscribed records that pre registrations exceed a capped section's capacity. It
// is a fact read from the counts, not an estimate of a student's chance. The summary
// takes only the seat fields, so a plan entry snapshot formats the same way a catalog
// section does.

import type { Translate, TranslationKey } from '../i18n/t';
import { fillTemplate } from '../i18n/template';
import { computeSeatStatus, type SeatFields } from './seatStatus';

export type SeatState = 'open' | 'uncapped' | 'full' | 'closed';

export interface SeatDemand {
  state: SeatState;
  /** Free seats, limit minus enrolled. A number only in the open state. */
  remaining: number | null;
  /** Seat capacity, or null when the section is uncapped. */
  limit: number | null;
  /** Enrolled seats, or null when the API reports only the full marker. */
  enrolled: number | null;
  preCount: number;
  queueLeft: number;
  oversubscribed: boolean;
}

export function computeSeatDemand(section: SeatFields): SeatDemand {
  const status = computeSeatStatus(section);
  const { limit, enrolled, preCount, queueLeft } = section.seats;
  const state: SeatState =
    status.kind === 'open'
      ? status.remaining === null
        ? 'uncapped'
        : 'open'
      : status.kind;
  return {
    state,
    remaining: status.kind === 'open' ? status.remaining : null,
    limit,
    enrolled: enrolled === 'full' ? null : enrolled,
    preCount,
    queueLeft,
    oversubscribed: limit !== null && preCount > limit,
  };
}

const LINE_KEY: Record<SeatState, TranslationKey> = {
  open: 'section.seats.open',
  uncapped: 'section.seats.uncapped',
  full: 'section.seats.full',
  closed: 'section.seats.closed',
};

/** The visible seat line: ว่าง 12 จาก 45, ไม่จำกัดที่นั่ง, เต็ม เพิ่มไม่ได้, or ปิด เพิ่มไม่ได้. */
export function seatLineText(demand: SeatDemand, t: Translate): string {
  return fillTemplate(t(LINE_KEY[demand.state]), {
    remaining: demand.remaining ?? 0,
    limit: demand.limit ?? 0,
  });
}
