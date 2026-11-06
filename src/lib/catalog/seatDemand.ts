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
// section does. The figures carry the four counts the host table shows under รับ, ลง,
// ล่วงหน้า, and คิว, so a student reads the same numbers in the same order here.

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

export type DemandFigureKey = 'limit' | 'enrolled' | 'pre' | 'queue';

export interface DemandFigure {
  key: DemandFigureKey;
  value: number;
}

export const DEMAND_LABEL_KEY: Record<DemandFigureKey, TranslationKey> = {
  limit: 'seat.demand.limit',
  enrolled: 'seat.demand.enrolled',
  pre: 'seat.demand.pre',
  queue: 'seat.demand.queue',
};

/**
 * The host's seat counts in its column order. A count the API does not give as a number
 * is left out rather than shown as a placeholder: an uncapped section has no limit, and a
 * full one reports only the full marker for enrolled. The seat line already states both.
 */
export function demandFigures(demand: SeatDemand): DemandFigure[] {
  const figures: DemandFigure[] = [];
  if (demand.limit !== null) {
    figures.push({ key: 'limit', value: demand.limit });
  }
  if (demand.enrolled !== null) {
    figures.push({ key: 'enrolled', value: demand.enrolled });
  }
  figures.push({ key: 'pre', value: demand.preCount });
  figures.push({ key: 'queue', value: demand.queueLeft });
  return figures;
}
