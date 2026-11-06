// The rows of the section comparison table: one per section of a course, each with its
// plan relation, seat status, and the one status the catalog row would show, so the
// table and the card cannot disagree about a section. The student narrows the rows to
// the sections that can be added now and orders them by the earliest start, the order
// the blocked feedback strip offers alternatives in, or by the most open seats. A sort
// keeps the course's section code order among equal keys, so the table reads stably.

import type { Course, Section } from '../domain/types';
import {
  computeSectionRelation,
  type SectionRelation,
  type TermContext,
} from '../planner/sectionState';
import { earliestStart } from '../planner/suggestions';
import { computeRowStatus, type RowStatus } from './rowStatus';
import { computeSeatStatus, type SeatStatus } from './seatStatus';

export type ComparisonSort = 'start' | 'seats';

export interface ComparisonOptions {
  /** Keep only the sections that place cleanly and have a seat. */
  onlyAddable: boolean;
  sort: ComparisonSort;
}

export interface ComparisonRow {
  section: Section;
  relation: SectionRelation;
  seat: SeatStatus;
  /** The catalog row status; null for a section that can be added now. */
  status: RowStatus | null;
}

/**
 * The open seat count a seat sort ranks by. An uncapped section has no limit, so it
 * ranks above any count; a full or closed section ranks below an open one with no
 * seat left.
 */
function openSeatKey(seat: SeatStatus): number {
  if (seat.kind !== 'open') {
    return -1;
  }
  return seat.remaining ?? Number.POSITIVE_INFINITY;
}

function compareRows(
  sort: ComparisonSort,
): (a: ComparisonRow, b: ComparisonRow) => number {
  if (sort === 'seats') {
    return (a, b) => {
      const keyA = openSeatKey(a.seat);
      const keyB = openSeatKey(b.seat);
      return keyA === keyB ? 0 : keyB > keyA ? 1 : -1;
    };
  }
  // Both keys can be infinite for two unscheduled sections, and Infinity minus Infinity
  // is NaN, so equal keys compare as equal explicitly.
  return (a, b) => {
    const keyA = earliestStart(a.section);
    const keyB = earliestStart(b.section);
    return keyA === keyB ? 0 : keyA < keyB ? -1 : 1;
  };
}

export function compareSections(
  course: Course,
  placed: Section[],
  term: TermContext | undefined,
  options: ComparisonOptions,
): ComparisonRow[] {
  const rows = course.sections.map((section): ComparisonRow => {
    const relation = computeSectionRelation(placed, course, section, term);
    const seat = computeSeatStatus(section);
    return {
      section,
      relation,
      seat,
      status: computeRowStatus(relation, seat),
    };
  });
  const kept = options.onlyAddable
    ? rows.filter((row) => row.status === null)
    : rows;
  return kept.sort(compareRows(options.sort));
}
