// The review layer over reconcile (ADR-0060). Reconcile applies upstream data on every
// run; this module decides which of the differences a student has to look at. A
// material change alters when, where, or whether the student sits the class or its
// exam. An ambient change, seat counts moving by the minute during pre registration or a
// teacher change, updates the display silently and never asks for review on its own.

import type {
  EntryReview,
  PlanEntry,
  ReviewKind,
  SectionSnapshot,
} from '../domain/plan';
import type {
  ChangeKind,
  ComparableSection,
  EntryOutcome,
} from './revalidateDiff';
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

/** Whether the student already acknowledged that the entry is no longer listed: it was
 * missing before this run and its review no longer holds that fact. */
function missingAcknowledged(
  entry: Pick<PlanEntry, 'verifyStatus' | 'review'>,
): boolean {
  return (
    entry.verifyStatus === 'missing' &&
    !(entry.review?.kinds.includes('missing') ?? false)
  );
}

/**
 * Merge one run into an entry's review. after is the snapshot the run applied, or null
 * when the entry is no longer listed. The comparison is always against the earliest
 * before, the snapshot as the student last reviewed it, so the open kinds are the union
 * of what every run since then changed, minus any that a later run returned to the old
 * value. A clean run therefore keeps the review, since the difference from before still
 * stands, and only a reverted value or an acknowledgement clears it. A kind that is new
 * to the review resets notifiedAt, since the student has not been shown it. Returns
 * undefined when nothing is left to review.
 */
export function mergeReview(
  entry: Pick<PlanEntry, 'snapshot' | 'review' | 'verifyStatus'>,
  after: SectionSnapshot | null,
  now: string,
): EntryReview | undefined {
  const existing = entry.review;
  const before = existing?.before ?? entry.snapshot;
  const kinds: ReviewKind[] = materialKinds(before, after ?? entry.snapshot);
  if (after === null && !missingAcknowledged(entry)) {
    kinds.push('missing');
  }
  if (kinds.length === 0) {
    return undefined;
  }
  const grew =
    existing === undefined ||
    kinds.some((kind) => !existing.kinds.includes(kind));
  return {
    kinds,
    before,
    detectedAt: existing?.detectedAt ?? now,
    notifiedAt: grew ? null : existing.notifiedAt,
  };
}

/** An entry with its review replaced, the key left out rather than set to undefined
 * when nothing is left to review, so a stored entry never carries an empty field. */
export function withReview(
  entry: PlanEntry,
  review: EntryReview | undefined,
): PlanEntry {
  if (review !== undefined) {
    return { ...entry, review };
  }
  const { review: cleared, ...rest } = entry;
  return cleared === undefined ? entry : rest;
}

/**
 * The outcome a run leaves on an entry: missing when the section is no longer listed,
 * changed exactly while a material review is open, and unchanged otherwise. A run whose
 * differences are all ambient, such as seat counts, therefore leaves the entry verified,
 * and an entry a seats only run left changed in an earlier build returns to verified on
 * its next run.
 */
export function reviewedOutcome(
  after: SectionSnapshot | null,
  review: EntryReview | undefined,
): EntryOutcome {
  if (after === null) {
    return 'missing';
  }
  return review === undefined ? 'unchanged' : 'changed';
}
