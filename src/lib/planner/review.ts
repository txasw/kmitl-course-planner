// The review layer over reconcile (ADR-0060). Reconcile applies upstream data on every
// run; this module decides which of the differences a student has to look at. A
// material change alters when, where, or whether the student sits the class or its
// exam. An ambient change, seat counts moving by the minute during pre registration or a
// teacher change, updates the display silently and never asks for review on its own.

import type { ChangeKind, ComparableSection } from './revalidateDiff';
import { diffSnapshot } from './revalidateDiff';

export type ChangeClass = 'material' | 'ambient';

/** The diff kinds that update the display without asking for review. */
type AmbientChangeKind = 'teacher_changed' | 'seats_changed';

/** The diff kinds that ask for review. */
export type MaterialChangeKind = Exclude<ChangeKind, AmbientChangeKind>;

/** The class of each diff kind. The mapped type ties each value to the ambient list, so
 * the table and the type guard below cannot disagree. A section turning closed is
 * material even though the diff reports it under seats, so materialKinds detects it
 * separately. */
export const CHANGE_CLASS: {
  [K in ChangeKind]: K extends AmbientChangeKind ? 'ambient' : 'material';
} = {
  time_changed: 'material',
  room_changed: 'material',
  pair_changed: 'material',
  exam_changed: 'material',
  teacher_changed: 'ambient',
  seats_changed: 'ambient',
};

/** A material difference between two versions of the same section. */
export type MaterialKind = MaterialChangeKind | 'closed';

/** Whether a diff kind asks for review. */
export function isMaterial(kind: ChangeKind): kind is MaterialChangeKind {
  const changeClass: ChangeClass = CHANGE_CLASS[kind];
  return changeClass === 'material';
}

/**
 * The material differences from an earlier version of a section to the current one, in
 * the diff's order with a newly closed section last. A section that reopened is not
 * listed, since it can be added again and the seat display already says so.
 */
export function materialKinds(
  before: ComparableSection,
  current: ComparableSection,
): MaterialKind[] {
  const kinds: MaterialKind[] = [];
  for (const kind of diffSnapshot(before, current)) {
    if (isMaterial(kind)) {
      kinds.push(kind);
    }
  }
  if (!before.isClosed && current.isClosed) {
    kinds.push('closed');
  }
  return kinds;
}
