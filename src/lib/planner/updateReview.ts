// The item list of the updates dialog (ADR-0060). It reads the plan entries rather than
// the latest run, because the review is persisted on each entry and outlives the run that
// found it: after a reload the dialog still lists what the student has not acknowledged.
// An entry is an item while it holds an open review, or while it is still not listed
// after the student acknowledged that, since it still sits on the grid with its danger
// badge and its remove action. Each item lands in one group, the most urgent its kinds
// reach, and every other entry sits in one collapsed unchanged group.

import type { PlanEntry, ReviewKind, SectionSnapshot } from '../domain/plan';
import type { EntryRef } from './placement';
import { diffSnapshot, type ChangeKind } from './revalidateDiff';

export type UpdateGroupKey = 'clash' | 'exam' | 'timeRoom' | 'other';

/** The groups in the order the dialog lists them, most urgent first. */
export const UPDATE_GROUP_ORDER: readonly UpdateGroupKey[] = [
  'clash',
  'exam',
  'timeRoom',
  'other',
];

/** A placed section a change now clashes with, in time or in its exam window. */
export type UpdateClash = Pick<EntryRef, 'subjectId' | 'section'>;

export interface UpdateItem {
  entry: PlanEntry;
  /** The open review kinds, with missing added for a section still not listed. */
  kinds: ReviewKind[];
  /** The fields to show as before and now. Seat counts are left out, since they are
   * ambient; a teacher change shows because it sits beside a material one. */
  changes: ChangeKind[];
  /** The snapshot as the student last reviewed it. */
  before: SectionSnapshot;
  /** The snapshot now, or null when the section is no longer listed. */
  after: SectionSnapshot | null;
  /** The clashes a time or exam change created. */
  clashes: UpdateClash[];
}

export interface UpdateGroup {
  key: UpdateGroupKey;
  items: UpdateItem[];
}

export interface UpdateReview {
  /** The non empty groups, in UPDATE_GROUP_ORDER. */
  groups: UpdateGroup[];
  /** The entries with nothing to review, including those whose only change was ambient. */
  unchanged: PlanEntry[];
}

/** The conflicts of each placed section keyed by teachTableId, time or exam alike. */
export type ConflictsById = ReadonlyMap<
  string,
  readonly { blocking: EntryRef }[]
>;

export interface UpdateReviewInput {
  entries: readonly PlanEntry[];
  timeConflicts: ConflictsById;
  examConflicts: ConflictsById;
}

function itemKinds(entry: PlanEntry): ReviewKind[] {
  const kinds = [...(entry.review?.kinds ?? [])];
  if (entry.verifyStatus === 'missing' && !kinds.includes('missing')) {
    kinds.push('missing');
  }
  return kinds;
}

type UpdateItemFields = Pick<PlanEntry, 'review' | 'verifyStatus'>;

function isUpdateItem(entry: UpdateItemFields): boolean {
  return entry.review !== undefined || entry.verifyStatus === 'missing';
}

/**
 * How many items the updates dialog lists: the entries holding an open review or still
 * not listed. The entry toast states this count, and hasUpdateItems reads it, so the
 * toast and the dialog never disagree about whether there is anything to review.
 */
export function countUpdateItems(entries: readonly UpdateItemFields[]): number {
  return entries.filter(isUpdateItem).length;
}

/** Whether the plan has anything for the updates dialog to list. */
export function hasUpdateItems(entries: readonly UpdateItemFields[]): boolean {
  return countUpdateItems(entries) > 0;
}

function clashesOf(
  id: string,
  kinds: readonly ReviewKind[],
  input: UpdateReviewInput,
): UpdateClash[] {
  const sources = [
    kinds.includes('time_changed') ? input.timeConflicts.get(id) : undefined,
    kinds.includes('exam_changed') ? input.examConflicts.get(id) : undefined,
  ];
  const clashes = new Map<string, UpdateClash>();
  for (const details of sources) {
    for (const { blocking } of details ?? []) {
      clashes.set(blocking.teachTableId, {
        subjectId: blocking.subjectId,
        section: blocking.section,
      });
    }
  }
  return [...clashes.values()];
}

function groupOf(item: UpdateItem): UpdateGroupKey {
  if (item.kinds.includes('missing') || item.clashes.length > 0) {
    return 'clash';
  }
  if (item.kinds.includes('exam_changed')) {
    return 'exam';
  }
  if (
    item.kinds.includes('time_changed') ||
    item.kinds.includes('room_changed')
  ) {
    return 'timeRoom';
  }
  return 'other';
}

/** The dialog's groups and its unchanged entries, in plan entry order within each. */
export function buildUpdateReview(input: UpdateReviewInput): UpdateReview {
  const byGroup = new Map<UpdateGroupKey, UpdateItem[]>();
  const unchanged: PlanEntry[] = [];
  for (const entry of input.entries) {
    const kinds = itemKinds(entry);
    if (kinds.length === 0) {
      unchanged.push(entry);
      continue;
    }
    const before = entry.review?.before ?? entry.snapshot;
    const after = kinds.includes('missing') ? null : entry.snapshot;
    const item: UpdateItem = {
      entry,
      kinds,
      changes:
        after === null
          ? []
          : diffSnapshot(before, after).filter(
              (change) => change !== 'seats_changed',
            ),
      before,
      after,
      clashes: clashesOf(entry.teachTableId, kinds, input),
    };
    const key = groupOf(item);
    byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
  }
  return {
    groups: UPDATE_GROUP_ORDER.flatMap((key) => {
      const items = byGroup.get(key);
      return items === undefined ? [] : [{ key, items }];
    }),
    unchanged,
  };
}

/**
 * The groups with the items the student removed from the dialog put back, so each stays
 * listed as removed with its undo. A removed item is no longer in the plan, so it is not
 * in the live groups; it joins the clash group, where a missing section is listed, and
 * leaves the list again once an undo brings its entry back. Returns the ids shown as
 * removed alongside the groups.
 */
export function withRemovedItems(
  groups: readonly UpdateGroup[],
  removed: readonly UpdateItem[],
  entries: readonly Pick<PlanEntry, 'teachTableId'>[],
): { groups: UpdateGroup[]; removedIds: Set<string> } {
  const present = new Set(entries.map((entry) => entry.teachTableId));
  const gone = removed.filter((item) => !present.has(item.entry.teachTableId));
  const removedIds = new Set(gone.map((item) => item.entry.teachTableId));
  if (gone.length === 0) {
    return { groups: [...groups], removedIds };
  }
  const clash = groups.find((group) => group.key === 'clash');
  const rest = groups.filter((group) => group.key !== 'clash');
  return {
    groups: [
      { key: 'clash', items: [...(clash?.items ?? []), ...gone] },
      ...rest,
    ],
    removedIds,
  };
}
