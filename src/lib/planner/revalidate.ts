// The pure match and diff core of plan revalidation and the pure reconcile that
// applies it. The API is the source of truth and snapshots are a cache, so
// revalidation matches each stored entry against fresh normalized data and
// classifies what changed. Matching is by teachTableId first and by the durable
// subjectId plus section identity second; a fallback match with a different id
// counts as matched and reports that the key moved. Reconcile then folds the fresh
// data back into new plan entries and reports old versus new; it stays pure so the
// plans feature only fetches and writes.

import type { Section } from '../domain/types';
import type {
  Plan,
  PlanEntry,
  SectionSnapshot,
  VerifyStatus,
} from '../domain/plan';
import { buildSnapshot } from '../domain/plan';
import type { NormalizedCatalog } from '../domain/normalize';

export type ChangeKind =
  | 'time_changed'
  | 'room_changed'
  | 'teacher_changed'
  | 'seats_changed'
  | 'pair_changed'
  | 'exam_changed';

export type EntryOutcome = 'unchanged' | 'changed' | 'missing';

export interface EntryRevalidation {
  teachTableId: string;
  subjectId: string;
  section: string;
  outcome: EntryOutcome;
  changes: ChangeKind[];
  /** True when the entry matched by durable identity under a different key. */
  keyChanged: boolean;
  /** The matched fresh teachTableId, or null when the entry is missing. */
  freshTeachTableId: string | null;
}

export interface RevalidationSummary {
  total: number;
  unchanged: number;
  changed: number;
  missing: number;
}

export interface PlanRevalidation {
  entries: EntryRevalidation[];
  summary: RevalidationSummary;
}

/** A fresh section with the subject metadata reconcile needs to rebuild a snapshot. */
export interface IndexedSection {
  section: Section;
  subjectMeta: SectionSnapshot['subjectMeta'];
}

export interface SectionIndex {
  byTeachTableId: Map<string, IndexedSection>;
  byIdentity: Map<string, IndexedSection>;
}

function identityKey(subjectId: string, section: string): string {
  return `${subjectId}|${section}`;
}

/** Index fresh normalized results for lookup by key and by durable identity, keeping
 * the subject metadata so reconcile can rebuild a full snapshot. */
export function buildSectionIndex(catalogs: NormalizedCatalog[]): SectionIndex {
  const byTeachTableId = new Map<string, IndexedSection>();
  const byIdentity = new Map<string, IndexedSection>();
  for (const catalog of catalogs) {
    for (const course of catalog.courses) {
      const subjectMeta = {
        subjectId: course.subjectId,
        nameTh: course.nameTh,
        nameEn: course.nameEn,
        credit: course.credit,
        creditStr: course.creditStr,
      };
      for (const section of course.sections) {
        const indexed: IndexedSection = { section, subjectMeta };
        byTeachTableId.set(section.teachTableId, indexed);
        byIdentity.set(
          identityKey(section.subjectId, section.section),
          indexed,
        );
      }
    }
  }
  return { byTeachTableId, byIdentity };
}

function matchEntry(
  entry: PlanEntry,
  index: SectionIndex,
): { indexed: IndexedSection; keyChanged: boolean } | null {
  // A key hit must also be the same subject and section, so a recycled teachTableId
  // never matches an entry to a different course; otherwise fall back to identity.
  const byKey = index.byTeachTableId.get(entry.teachTableId);
  if (byKey !== undefined) {
    if (
      byKey.section.subjectId === entry.subjectId &&
      byKey.section.section === entry.section
    ) {
      return { indexed: byKey, keyChanged: false };
    }
  }
  const byIdentity = index.byIdentity.get(
    identityKey(entry.subjectId, entry.section),
  );
  if (byIdentity) {
    return { indexed: byIdentity, keyChanged: true };
  }
  return null;
}

function timeFootprint(section: Pick<Section, 'meetings'>): string {
  return section.meetings
    .map((m) => `${String(m.day)}:${String(m.startMin)}-${String(m.endMin)}`)
    .sort()
    .join(',');
}

function roomFootprint(section: Pick<Section, 'meetings'>): string {
  return section.meetings
    .map((m) => `${m.building}/${m.room}`)
    .sort()
    .join(',');
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function seatsEqual(
  a: Pick<Section, 'seats' | 'isClosed'>,
  b: Pick<Section, 'seats' | 'isClosed'>,
): boolean {
  return (
    a.seats.limit === b.seats.limit &&
    a.seats.preCount === b.seats.preCount &&
    a.seats.queueLeft === b.seats.queueLeft &&
    a.seats.enrolled === b.seats.enrolled &&
    a.isClosed === b.isClosed
  );
}

function rangesEqual(
  a: { start: string; end: string } | undefined,
  b: { start: string; end: string } | undefined,
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return a.start === b.start && a.end === b.end;
}

// The snapshot exam type infers optional properties as `T | undefined`, while the
// domain Exam type omits undefined, so compare against a shape both satisfy.
interface ExamLike {
  midterm?: { start: string; end: string } | undefined;
  final?: { start: string; end: string } | undefined;
  note?: string | undefined;
}

function examEqual(a: ExamLike, b: ExamLike): boolean {
  return (
    rangesEqual(a.midterm, b.midterm) &&
    rangesEqual(a.final, b.final) &&
    (a.note ?? null) === (b.note ?? null)
  );
}

/** Classify the differences between a stored snapshot and a fresh section. */
export function diffSnapshot(
  snapshot: SectionSnapshot,
  fresh: Section,
): ChangeKind[] {
  const changes: ChangeKind[] = [];
  if (timeFootprint(snapshot) !== timeFootprint(fresh)) {
    changes.push('time_changed');
  }
  if (roomFootprint(snapshot) !== roomFootprint(fresh)) {
    changes.push('room_changed');
  }
  if (
    !arraysEqual(snapshot.teachersTh, fresh.teachersTh) ||
    !arraysEqual(snapshot.teachersEn, fresh.teachersEn)
  ) {
    changes.push('teacher_changed');
  }
  if (!seatsEqual(snapshot, fresh)) {
    changes.push('seats_changed');
  }
  if (snapshot.pairedSection !== fresh.pairedSection) {
    changes.push('pair_changed');
  }
  if (!examEqual(snapshot.exam, fresh.exam)) {
    changes.push('exam_changed');
  }
  return changes;
}

/** Match and diff a single entry against the fresh index. */
export function revalidateEntry(
  entry: PlanEntry,
  index: SectionIndex,
): EntryRevalidation {
  const match = matchEntry(entry, index);
  if (match === null) {
    return {
      teachTableId: entry.teachTableId,
      subjectId: entry.subjectId,
      section: entry.section,
      outcome: 'missing',
      changes: [],
      keyChanged: false,
      freshTeachTableId: null,
    };
  }
  const changes = diffSnapshot(entry.snapshot, match.indexed.section);
  return {
    teachTableId: entry.teachTableId,
    subjectId: entry.subjectId,
    section: entry.section,
    outcome: changes.length === 0 ? 'unchanged' : 'changed',
    changes,
    keyChanged: match.keyChanged,
    freshTeachTableId: match.indexed.section.teachTableId,
  };
}

/** Revalidate every entry in a plan against the fresh index and summarize. */
export function revalidatePlan(
  plan: Plan,
  index: SectionIndex,
): PlanRevalidation {
  const entries = plan.entries.map((entry) => revalidateEntry(entry, index));
  const summary: RevalidationSummary = {
    total: entries.length,
    unchanged: entries.filter((e) => e.outcome === 'unchanged').length,
    changed: entries.filter((e) => e.outcome === 'changed').length,
    missing: entries.filter((e) => e.outcome === 'missing').length,
  };
  return { entries, summary };
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

/** One entry's before and after, for the detail sheet and the block popover. */
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
  const match = matchEntry(entry, index);
  if (match === null) {
    // Keep the last known snapshot so the block stays on the grid at its last time;
    // mark it missing and never delete it silently.
    return {
      entry: { ...entry, lastVerifiedAt: now, verifyStatus: 'missing' },
      diff: {
        teachTableId: entry.teachTableId,
        subjectId: entry.subjectId,
        section: entry.section,
        outcome: 'missing',
        changes: [],
        before,
        after: null,
      },
    };
  }
  const fresh = match.indexed.section;
  const changes = diffSnapshot(before, fresh);
  const outcome: EntryOutcome = changes.length === 0 ? 'unchanged' : 'changed';
  // Adopt the fresh key silently, unless it already belongs to another entry, which
  // would make two entries share a teachTableId; keep the old key in that case.
  const collides =
    fresh.teachTableId !== entry.teachTableId &&
    planIds.has(fresh.teachTableId);
  const newId =
    match.keyChanged && !collides ? fresh.teachTableId : entry.teachTableId;
  const after: SectionSnapshot = {
    ...buildSnapshot(fresh, match.indexed.subjectMeta),
    teachTableId: newId,
  };
  return {
    entry: {
      ...entry,
      teachTableId: newId,
      snapshot: after,
      lastVerifiedAt: now,
      verifyStatus: OUTCOME_STATUS[outcome],
    },
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
 * each entry itself, so the returned report is the single source of truth and cannot
 * drift from a separately computed revalidation. The plan's updatedAt is untouched
 * because reconcile is not a user edit. Term mismatches are reported, not fixed. Pure:
 * it builds new entries and never mutates the input plan or its snapshots.
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
    if (
      entry.sourceQuery.params.selected_year !== plan.year ||
      entry.sourceQuery.params.selected_semester !== plan.semester
    ) {
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
  const summary: RevalidationSummary = {
    total: diffs.length,
    unchanged: diffs.filter((diff) => diff.outcome === 'unchanged').length,
    changed: diffs.filter((diff) => diff.outcome === 'changed').length,
    missing: diffs.filter((diff) => diff.outcome === 'missing').length,
  };
  return {
    plan: { ...plan, entries },
    report: { summary, entries: diffs, termFindings },
  };
}
