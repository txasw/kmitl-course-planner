// The facts an export poster states as text in place of the edit mode verification badges
// (ADR-0055): how current the data is, how many entries upstream no longer lists, and how many
// section pairs clash. The poster is only as current as its least recently checked section, so
// the data date is the oldest verification. An entry never checked since it was added came from
// a live search and does not hold the date back; when no entry has been checked at all, as for
// an imported plan before its first check, the date reads unverified rather than invented.

import type { PlanEntry } from '../domain/plan';
import type { ExamOverlap } from './examOverlap';
import type { ConflictDetail } from './placement';

export type DataDate = { kind: 'asOf'; at: string } | { kind: 'unverified' };

export interface PosterHonesty {
  dataDate: DataDate;
  /** Entries whose latest check found them no longer listed upstream. */
  missingCount: number;
  /** Distinct section pairs that clash on time or on an exam window, once per pair. */
  conflictPairCount: number;
}

export interface PosterHonestyInput {
  entries: readonly Pick<PlanEntry, 'lastVerifiedAt' | 'verifyStatus'>[];
  /** The time conflicts per teachTableId, as planConflicts reports them. */
  timeConflicts: ReadonlyMap<string, readonly ConflictDetail[]>;
  /** The exam overlaps per teachTableId, as planExamConflicts reports them. */
  examConflicts: ReadonlyMap<string, readonly ExamOverlap[]>;
}

/** How current the plan data is: the oldest verification among the entries that were
 * checked, or unverified when none was. The poster footer and the verification status in the
 * edit stats bar and the preview toolbar both state it. */
export function planDataDate(
  entries: readonly Pick<PlanEntry, 'lastVerifiedAt'>[],
): DataDate {
  let oldest: { at: string; ms: number } | null = null;
  for (const entry of entries) {
    if (entry.lastVerifiedAt === null) {
      continue;
    }
    const ms = Date.parse(entry.lastVerifiedAt);
    if (Number.isNaN(ms)) {
      continue;
    }
    if (oldest === null || ms < oldest.ms) {
      oldest = { at: entry.lastVerifiedAt, ms };
    }
  }
  return oldest === null
    ? { kind: 'unverified' }
    : { kind: 'asOf', at: oldest.at };
}

// Both conflict maps record a clash on each side of the pair, so an unordered key collapses
// the two sides, and a pair that clashes on time and on an exam counts once.
function countConflictPairs(
  maps: readonly ReadonlyMap<
    string,
    readonly { blocking: { teachTableId: string } }[]
  >[],
): number {
  const pairs = new Set<string>();
  for (const map of maps) {
    for (const [id, details] of map) {
      for (const detail of details) {
        const other = detail.blocking.teachTableId;
        pairs.add(id < other ? `${id}|${other}` : `${other}|${id}`);
      }
    }
  }
  return pairs.size;
}

export function posterHonesty(input: PosterHonestyInput): PosterHonesty {
  return {
    dataDate: planDataDate(input.entries),
    missingCount: input.entries.filter(
      (entry) => entry.verifyStatus === 'missing',
    ).length,
    conflictPairCount: countConflictPairs([
      input.timeConflicts,
      input.examConflicts,
    ]),
  };
}

/** The entries to look at before sharing: those whose latest check found a change not yet
 * acknowledged, or found them no longer listed. The pre share notice states this count. */
export function reviewBeforeShareCount(
  entries: readonly Pick<PlanEntry, 'verifyStatus'>[],
): number {
  return entries.filter(
    (entry) =>
      entry.verifyStatus === 'changed' || entry.verifyStatus === 'missing',
  ).length;
}
