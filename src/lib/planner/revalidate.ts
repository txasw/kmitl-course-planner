// The pure match and diff core of plan revalidation. The API is the source of
// truth and snapshots are a cache, so revalidation matches each stored entry
// against fresh normalized data and classifies what changed. Matching is by
// teachTableId first and by the durable subjectId plus section identity second; a
// fallback match with a different id counts as matched and reports that the key
// moved. The reconcile step that writes updated snapshots with timestamps lives
// in the plans feature; this module stays pure.

import type { Section } from '../domain/types';
import type { Plan, PlanEntry, SectionSnapshot } from '../domain/plan';
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

export interface SectionIndex {
  byTeachTableId: Map<string, Section>;
  byIdentity: Map<string, Section>;
}

function identityKey(subjectId: string, section: string): string {
  return `${subjectId}|${section}`;
}

/** Index fresh normalized results for lookup by key and by durable identity. */
export function buildSectionIndex(catalogs: NormalizedCatalog[]): SectionIndex {
  const byTeachTableId = new Map<string, Section>();
  const byIdentity = new Map<string, Section>();
  for (const catalog of catalogs) {
    for (const course of catalog.courses) {
      for (const section of course.sections) {
        byTeachTableId.set(section.teachTableId, section);
        byIdentity.set(
          identityKey(section.subjectId, section.section),
          section,
        );
      }
    }
  }
  return { byTeachTableId, byIdentity };
}

function matchEntry(
  entry: PlanEntry,
  index: SectionIndex,
): { section: Section; keyChanged: boolean } | null {
  const byKey = index.byTeachTableId.get(entry.teachTableId);
  if (byKey) {
    return { section: byKey, keyChanged: false };
  }
  const byIdentity = index.byIdentity.get(
    identityKey(entry.subjectId, entry.section),
  );
  if (byIdentity) {
    return { section: byIdentity, keyChanged: true };
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
  const changes = diffSnapshot(entry.snapshot, match.section);
  return {
    teachTableId: entry.teachTableId,
    subjectId: entry.subjectId,
    section: entry.section,
    outcome: changes.length === 0 ? 'unchanged' : 'changed',
    changes,
    keyChanged: match.keyChanged,
    freshTeachTableId: match.section.teachTableId,
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
