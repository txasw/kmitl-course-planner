// The one status a catalog section row announces. A row can carry several facts at
// once, for example a full section that also clashes with the plan, and showing a
// badge per fact stacks two or three danger cues for what a student reads as one
// answer: can I take this section. The precedence puts the facts that end the
// question first. A section browsed in another term belongs to no comparison with
// the plan, a closed or full section cannot be added by any path, so its conflict
// is noise, and an added section needs no further verdict. Below those, a duplicate
// subject outranks a clash, and a time clash outranks an exam clash, so an exam
// clash only reads when every conflict is an exam overlap. An addable row has no
// status, because a badge on every addable row would repeat on most of the list.

import type { SectionRelation } from '../planner/sectionState';
import type { SeatStatus } from './seatStatus';

export type RowStatus =
  | 'different_term'
  | 'closed'
  | 'full'
  | 'added'
  | 'duplicate'
  | 'time_conflict'
  | 'exam_clash';

export function computeRowStatus(
  relation: SectionRelation,
  seat: SeatStatus,
): RowStatus | null {
  if (relation.kind === 'different_term') {
    return 'different_term';
  }
  if (seat.kind === 'closed' || seat.kind === 'full') {
    return seat.kind;
  }
  switch (relation.kind) {
    case 'added':
      return 'added';
    case 'duplicate':
      return 'duplicate';
    case 'conflicting':
      return relation.conflicts.length > 0 &&
        relation.conflicts.every((conflict) => conflict.kind === 'exam')
        ? 'exam_clash'
        : 'time_conflict';
    case 'addable':
      return null;
  }
}

/** Whether the row announces a clash with the plan. A closed or full section that
 * also clashes reads closed or full, so its conflict callout is suppressed with the
 * badge: the section cannot be added by any path, and the clash would be noise. */
export function isConflictStatus(status: RowStatus | null): boolean {
  return status === 'time_conflict' || status === 'exam_clash';
}
