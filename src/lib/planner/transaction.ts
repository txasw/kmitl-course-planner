// Pure add and remove transactions over a plan's entries. Adding validates the
// section group against the placed sections and, when it fits, appends a plan
// entry per group member so a lecture and practice pair join atomically. Removing
// takes a section and its declared pair out together. Both return the new entries
// and the affected group so the store can drive undo and feedback. Credits fold in
// unscheduled sections because a subject's credit does not depend on a meeting.

import type { Course, Section } from '../domain/types';
import type { PlanEntry, SectionSnapshot, SourceQuery } from '../domain/plan';
import { snapshotToSection } from '../domain/plan';
import {
  checkPlacement,
  expandSectionGroup,
  type ConflictDetail,
} from './placement';
import { summarizeCredits, type CreditSummary } from './credits';

/** The placed sections a plan holds, rebuilt from its entry snapshots. */
export function placedSections(entries: PlanEntry[]): Section[] {
  return entries.map((entry) => snapshotToSection(entry.snapshot));
}

function toSnapshot(course: Course, section: Section): SectionSnapshot {
  return {
    teachTableId: section.teachTableId,
    subjectId: section.subjectId,
    section: section.section,
    kind: section.kind,
    pairedSection: section.pairedSection,
    meetings: section.meetings,
    teachersTh: section.teachersTh,
    teachersEn: section.teachersEn,
    seats: section.seats,
    isClosed: section.isClosed,
    exam: section.exam,
    rulesTh: section.rulesTh,
    rulesEn: section.rulesEn,
    remark: section.remark,
    subjectMeta: {
      subjectId: course.subjectId,
      nameTh: course.nameTh,
      nameEn: course.nameEn,
      credit: course.credit,
      creditStr: course.creditStr,
    },
  };
}

function toEntry(
  course: Course,
  section: Section,
  sourceQuery: SourceQuery,
  now: string,
): PlanEntry {
  return {
    teachTableId: section.teachTableId,
    subjectId: section.subjectId,
    section: section.section,
    addedAt: now,
    lastVerifiedAt: null,
    verifyStatus: 'unverified',
    sourceQuery,
    snapshot: toSnapshot(course, section),
  };
}

export interface AddSuccess {
  entries: PlanEntry[];
  added: PlanEntry[];
}

export type AddOutcome =
  { ok: true; result: AddSuccess } | { ok: false; conflicts: ConflictDetail[] };

/**
 * Add a section and its declared pair to the plan atomically. Validation runs
 * against the placed sections; on any conflict nothing is added and the conflicts
 * are returned. An unscheduled section has no meeting to collide, so it is added
 * unless it duplicates a subject already in the plan.
 */
export function addSectionGroup(
  entries: PlanEntry[],
  course: Course,
  section: Section,
  sourceQuery: SourceQuery,
  now: string,
): AddOutcome {
  const group = expandSectionGroup(course, section);
  const placement = checkPlacement(placedSections(entries), group);
  if (!placement.ok) {
    return { ok: false, conflicts: placement.conflicts };
  }
  const added = group.map((member) =>
    toEntry(course, member, sourceQuery, now),
  );
  return { ok: true, result: { entries: [...entries, ...added], added } };
}

export interface RemoveResult {
  entries: PlanEntry[];
  removed: PlanEntry[];
}

/**
 * Remove an entry and, when it is half of a declared pair, its sibling too, so a
 * lecture and practice pair leave together. Returns the removed entries for undo.
 */
export function removeEntry(
  entries: PlanEntry[],
  teachTableId: string,
): RemoveResult {
  const target = entries.find((entry) => entry.teachTableId === teachTableId);
  if (target === undefined) {
    return { entries, removed: [] };
  }
  const removedIds = new Set<string>([target.teachTableId]);
  const pairedSection = target.snapshot.pairedSection;
  if (pairedSection !== null) {
    const sibling = entries.find(
      (entry) =>
        entry.subjectId === target.subjectId && entry.section === pairedSection,
    );
    if (sibling !== undefined) {
      removedIds.add(sibling.teachTableId);
    }
  }
  return {
    entries: entries.filter((entry) => !removedIds.has(entry.teachTableId)),
    removed: entries.filter((entry) => removedIds.has(entry.teachTableId)),
  };
}

/** Total credits and distinct subjects across the plan, including unscheduled ones. */
export function planCredits(entries: PlanEntry[]): CreditSummary {
  return summarizeCredits(
    entries.map((entry) => ({
      subjectId: entry.subjectId,
      credit: entry.snapshot.subjectMeta.credit,
    })),
  );
}
