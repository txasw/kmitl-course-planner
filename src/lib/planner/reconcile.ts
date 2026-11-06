// The pure reconcile that applies plan revalidation. Matching and diffing live in
// revalidateDiff; reconcile folds the fresh data back into new plan entries and
// reports old versus new. It stays pure so the plans feature only fetches and writes.

import type {
  Plan,
  PlanEntry,
  SectionSnapshot,
  VerifyStatus,
} from '../domain/plan';
import { buildSnapshot, entryTermMatches } from '../domain/plan';
import {
  revalidateEntry,
  type ChangeKind,
  type EntryOutcome,
  type SectionIndex,
} from './revalidateDiff';
import { mergeReview, reviewedOutcome, withReview } from './review';

export interface RevalidationSummary {
  total: number;
  unchanged: number;
  changed: number;
  missing: number;
}

/** Count entries by outcome in one pass. */
export function summarize(
  outcomes: readonly { outcome: EntryOutcome }[],
): RevalidationSummary {
  const summary: RevalidationSummary = {
    total: outcomes.length,
    unchanged: 0,
    changed: 0,
    missing: 0,
  };
  for (const { outcome } of outcomes) {
    summary[outcome] += 1;
  }
  return summary;
}

const OUTCOME_STATUS: Record<EntryOutcome, VerifyStatus> = {
  unchanged: 'verified',
  changed: 'changed',
  missing: 'missing',
};

/** A plan entry whose stored term does not match the plan term, reported not fixed. */
export interface ReconcileFinding {
  teachTableId: string;
  subjectId: string;
  section: string;
}

/** One entry's before and after, for the detail sheet and the block popover. The
 * outcome follows the entry's review, while changes lists every difference this run
 * found, ambient ones included. */
export interface EntryDiff {
  teachTableId: string;
  subjectId: string;
  section: string;
  outcome: EntryOutcome;
  changes: ChangeKind[];
  before: SectionSnapshot;
  after: SectionSnapshot | null;
}

export interface ReconcileReport {
  summary: RevalidationSummary;
  entries: EntryDiff[];
  /** Entries whose source query term did not match the plan term. */
  termFindings: ReconcileFinding[];
}

export interface ReconcileResult {
  plan: Plan;
  report: ReconcileReport;
}

function reconcileEntry(
  entry: PlanEntry,
  index: SectionIndex,
  now: string,
  planIds: Set<string>,
): { entry: PlanEntry; diff: EntryDiff } {
  const before = entry.snapshot;
  const { fresh, changes, keyChanged } = revalidateEntry(entry, index);
  if (fresh === null) {
    // Keep the last known snapshot so the block stays on the grid at its last time;
    // mark it missing and never delete it silently.
    const review = mergeReview(entry, null, now);
    const outcome = reviewedOutcome(null, review);
    return {
      entry: withReview(
        {
          ...entry,
          lastVerifiedAt: now,
          verifyStatus: OUTCOME_STATUS[outcome],
        },
        review,
      ),
      diff: {
        teachTableId: entry.teachTableId,
        subjectId: entry.subjectId,
        section: entry.section,
        outcome,
        changes,
        before,
        after: null,
      },
    };
  }
  const freshId = fresh.section.teachTableId;
  // Adopt the fresh key silently, unless it already belongs to another entry, which
  // would make two entries share a teachTableId; keep the old key in that case.
  const collides = freshId !== entry.teachTableId && planIds.has(freshId);
  const newId = keyChanged && !collides ? freshId : entry.teachTableId;
  const after: SectionSnapshot = {
    ...buildSnapshot(fresh.section, fresh.subjectMeta),
    teachTableId: newId,
  };
  const review = mergeReview(entry, after, now);
  const outcome = reviewedOutcome(after, review);
  return {
    entry: withReview(
      {
        ...entry,
        teachTableId: newId,
        snapshot: after,
        lastVerifiedAt: now,
        verifyStatus: OUTCOME_STATUS[outcome],
      },
      review,
    ),
    diff: {
      teachTableId: newId,
      subjectId: entry.subjectId,
      section: entry.section,
      outcome,
      changes,
      before,
      after,
    },
  };
}

/**
 * Reconcile a plan against fresh normalized data: update each matched entry's
 * snapshot to the fresh data, set its verification status and time, keep a missing
 * entry at its last known time, and adopt a moved key silently. It matches and diffs
 * each entry itself, so the returned report is the single source of truth for the
 * revalidation outcome. The plan's updatedAt is untouched because reconcile is not a
 * user edit. Term mismatches are reported, not fixed. Pure: it builds new entries and
 * never mutates the input plan or its snapshots.
 */
export function reconcilePlan(
  plan: Plan,
  index: SectionIndex,
  now: string,
): ReconcileResult {
  const planIds = new Set(plan.entries.map((entry) => entry.teachTableId));
  const entries: PlanEntry[] = [];
  const diffs: EntryDiff[] = [];
  const termFindings: ReconcileFinding[] = [];
  for (const entry of plan.entries) {
    if (!entryTermMatches(entry, plan)) {
      termFindings.push({
        teachTableId: entry.teachTableId,
        subjectId: entry.subjectId,
        section: entry.section,
      });
    }
    const reconciled = reconcileEntry(entry, index, now, planIds);
    entries.push(reconciled.entry);
    diffs.push(reconciled.diff);
  }
  return {
    plan: { ...plan, entries },
    report: { summary: summarize(diffs), entries: diffs, termFindings },
  };
}
