// The pure match and diff core of plan revalidation. The API is the source of truth
// and snapshots are a cache, so revalidation matches each stored entry against fresh
// normalized data and classifies what changed. Matching is by teachTableId first and
// by the durable subjectId plus section identity second; a fallback match with a
// different id counts as matched and reports that the key moved. Folding the result
// back into the plan is the reconcile module's job.

import type { Section } from '../domain/types';
import type { PlanEntry, SectionSnapshot } from '../domain/plan';
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
  /** The matched fresh section, or null when the entry is missing. */
  fresh: IndexedSection | null;
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

/** The fields a diff compares, which a fresh Section and a stored snapshot both carry,
 * so a review can also compare an earlier snapshot against the current one. */
export type ComparableSection = Pick<
  Section,
  | 'meetings'
  | 'teachersTh'
  | 'teachersEn'
  | 'seats'
  | 'isClosed'
  | 'pairedSection'
> & { exam: ExamLike };

/**
 * Classify the differences between a stored snapshot and a fresh section. offeredTo is
 * deliberately not compared: grouping membership depends on the query that produced the
 * section, not on the section itself, so it has no change kind (ADR-0061).
 */
export function diffSnapshot(
  snapshot: ComparableSection,
  fresh: ComparableSection,
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
      fresh: null,
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
    fresh: match.indexed,
  };
}
