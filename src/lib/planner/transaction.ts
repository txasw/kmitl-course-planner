// Pure add and remove transactions over a plan's entries. Adding validates the
// section group against the placed sections and, when it fits, appends a plan
// entry per group member so a lecture and practice pair join atomically. Removing
// takes a section and its declared pair out together. Both return the new entries
// and the affected group so the store can drive undo and feedback. Credits fold in
// unscheduled sections because a subject's credit does not depend on a meeting.

import type { Course, Section } from '../domain/types';
import type { PlanEntry, SectionSnapshot, SourceQuery } from '../domain/plan';
import { snapshotToSection } from '../domain/plan';
import { termsEqual, type Term } from '../routing/academicTerms';
import {
  checkPlacement,
  expandSectionGroup,
  type ConflictDetail,
} from './placement';
import { termFromSourceQueryParams } from './sourceQuery';
import { summarizeCredits, type CreditSummary } from './credits';

/** A rejected add whose section came from a query for a different term than the plan. */
export interface TermMismatch {
  planTerm: Term;
  incomingTerm: Term;
}

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
  | { ok: true; result: AddSuccess }
  | { ok: false; conflicts: ConflictDetail[] }
  | { ok: false; crossTerm: TermMismatch };

/**
 * Add a section and its declared pair to the plan atomically. The section must come
 * from a query for the plan's own term; a cross term add is rejected before any
 * placement check, since a plan belongs to exactly one year and semester. Placement
 * then runs against the placed sections; on any conflict nothing is added and the
 * conflicts are returned. An unscheduled section has no meeting to collide, so it is
 * added unless it duplicates a subject already in the plan.
 */
export function addSectionGroup(
  entries: PlanEntry[],
  course: Course,
  section: Section,
  sourceQuery: SourceQuery,
  now: string,
  planTerm: Term,
): AddOutcome {
  const incomingTerm = termFromSourceQueryParams(sourceQuery.params);
  if (!termsEqual(incomingTerm, planTerm)) {
    return { ok: false, crossTerm: { planTerm, incomingTerm } };
  }
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

/** The section to add in a transaction, with the source query to stamp on it. */
export interface AddInput {
  course: Course;
  section: Section;
  sourceQuery: SourceQuery;
}

export interface TransactionSuccess {
  entries: PlanEntry[];
  added: PlanEntry[];
  removed: PlanEntry[];
}

export type TransactionOutcome =
  | { ok: true; result: TransactionSuccess }
  | { ok: false; conflicts: ConflictDetail[] }
  | { ok: false; crossTerm: TermMismatch };

/**
 * Apply a remove then add over the plan's entries as one atomic step. Each id in
 * removeIds takes its section and declared pair out, so a removed id whose pair is
 * also listed is a no op the second time. When add is given, its section and pair are
 * validated against the plan's term and the reduced entries and appended; on a cross
 * term add or any conflict nothing changes and the reason is returned. One primitive
 * expresses add (no removeIds), remove (no add), move (remove the origin), and swap
 * (remove the blocker, plus the origin when a placed block moves onto a swap target).
 */
export function applyPlanTransaction(
  entries: PlanEntry[],
  removeIds: string[],
  add: AddInput | null,
  now: string,
  planTerm: Term,
): TransactionOutcome {
  let working = entries;
  const removed: PlanEntry[] = [];
  for (const id of removeIds) {
    const step = removeEntry(working, id);
    working = step.entries;
    removed.push(...step.removed);
  }
  if (add === null) {
    return { ok: true, result: { entries: working, added: [], removed } };
  }
  const outcome = addSectionGroup(
    working,
    add.course,
    add.section,
    add.sourceQuery,
    now,
    planTerm,
  );
  if (!outcome.ok) {
    return outcome;
  }
  return {
    ok: true,
    result: {
      entries: outcome.result.entries,
      added: outcome.result.added,
      removed,
    },
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
