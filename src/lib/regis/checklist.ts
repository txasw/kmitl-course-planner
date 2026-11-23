// The registration checklist: one row per planned subject, its planned section group, the
// other groups from the kit, what the read only observer saw on the page while it is
// healthy (ADR-0077), and the mark the student set by hand, which overrides the page and
// is shown beside it. The derivation is one pure function, so the dock and the tests
// read the same states. A plan of another term than the page, a kit of another
// term than the plan, and marks saved for another term are never mixed in: a kit or a
// mark of another term is ignored, and a page term that differs puts every row in the
// term mismatch state.

import { z } from 'zod';
import type { Plan, SectionSnapshot } from '../domain/plan';
import { groupEntriesBySubject } from '../planner/subjectGroups';
import { planCredits } from '../planner/transaction';
import { termsEqual, type Term } from '../routing/academicTerms';
import { kitConditions, kitMatchesPlan, plannedSections } from './kit';
import {
  observeRow,
  pageExtras,
  type ObservedPage,
  type ObservedRow,
  type ObservedState,
} from './observedRow';
import type { KitFit, KitSeat, KitSubject, RegistrationKit } from './kitSchema';

/** The marks a student can set on a row by hand. */
export const MARK_STATES = [
  'added',
  'addedOther',
  'conditional',
  'skipped',
] as const;
export type MarkState = (typeof MARK_STATES)[number];

export const checklistMarkSchema = z.object({
  state: z.enum(MARK_STATES),
  /** For addedOther: the teach table ids of the group the student took instead. */
  chosenIds: z.array(z.string()).optional(),
  at: z.iso.datetime(),
});
export type ChecklistMark = z.infer<typeof checklistMarkSchema>;

/** The student's marks for one plan in one term, keyed by subject id. */
export const checklistMarksSchema = z.object({
  planId: z.string(),
  year: z.string(),
  semester: z.enum(['1', '2', '3']),
  marks: z.record(z.string(), checklistMarkSchema),
});
export type ChecklistMarks = z.infer<typeof checklistMarksSchema>;

export type RowState =
  | 'notDone'
  | MarkState
  | 'termMismatch'
  | 'refused'
  | 'submitted'
  | 'granted'
  | 'notGranted'
  | 'notSubmitted';

/** The row state each page reading stands for when the student set no mark. */
const OBSERVED_STATE: Record<ObservedState, RowState> = {
  notListed: 'notDone',
  listed: 'added',
  listedOther: 'addedOther',
  refused: 'refused',
  waiting: 'submitted',
  granted: 'granted',
  notGranted: 'notGranted',
  notGrantedCondition: 'notGranted',
  notSubmitted: 'notSubmitted',
};

/** States that do not settle a row: nothing done yet, or the page turned it down. */
const UNSETTLED: readonly RowState[] = [
  'notDone',
  'termMismatch',
  'refused',
  'notSubmitted',
];

/** One other section group of a subject, with its fit and seats at prepare time. */
export interface RowAlternative {
  ids: string[];
  sections: SectionSnapshot[];
  fit: KitFit;
  seat: KitSeat;
  ownCurriculum: boolean | null;
}

export interface ChecklistRow {
  subjectId: string;
  nameTh: string;
  nameEn: string;
  credit: number;
  /** The planned group: from the kit when it lists it, else the plan snapshots. */
  planned: SectionSnapshot[];
  /** Other groups, fitting and open first, earliest start first; empty without a kit. */
  alternatives: RowAlternative[];
  state: RowState;
  /** The student's own mark, which overrides the page, or null. */
  mark: MarkState | null;
  /** What the page shows for the subject while the observer is healthy, or null. */
  observed: ObservedRow | null;
  /** The group marked as taken instead, when the student chose one from the kit. */
  chosen: RowAlternative | null;
  conditionsTh: string[];
  conditionsEn: string[];
  /** A planned code listed more than once under different curricula, or null. */
  duplicateCode: string | null;
  /** Whether a fresh kit lacks the planned group, or could not read the subject. */
  missing: boolean;
  /** The planned group's seats at prepare time, or null without a kit. */
  plannedSeat: KitSeat | null;
}

export interface Checklist {
  term: Term;
  /** Whether the page term is known and differs from the plan term. */
  termMismatch: boolean;
  /** Whether a fresh kit of this plan's term backs the rows. */
  hasKit: boolean;
  rows: ChecklistRow[];
  /** Whether a healthy page observation backs the rows. */
  observed: boolean;
  /** Subjects the page lists that the plan does not hold. */
  extras: { subjectId: string; codes: string[] }[];
  /** Planned subjects the page lists with their planned group. */
  listedPlanned: number;
  /** Rows settled by a mark or by the page. */
  done: number;
  total: number;
  credits: number;
}

export interface ChecklistInput {
  plan: Plan;
  /** A kit already checked for age by the caller, or null. */
  kit: RegistrationKit | null;
  marks: ChecklistMarks | null;
  /** The term the page shows, or null when KCP does not read it. */
  pageTerm: Term | null;
  /** The healthy page observation, or null while the observer is off or waiting. */
  page?: ObservedPage | null;
}

function earliest(sections: readonly SectionSnapshot[]): number {
  const starts = sections.flatMap((section) =>
    section.meetings.map((meeting) => meeting.day * 1440 + meeting.startMin),
  );
  return starts.length === 0 ? Infinity : Math.min(...starts);
}

const RANK: Record<KitFit, number> = { fits: 0, exam: 1, time: 2 };
const SEAT_RANK: Record<KitSeat, number> = { open: 0, full: 1, closed: 2 };

function alternativesOf(subject: KitSubject): RowAlternative[] {
  const byId = new Map(
    subject.sections.map((section) => [section.teachTableId, section]),
  );
  return subject.options
    .filter((option) => !option.planned)
    .map((option) => ({
      ids: option.ids,
      sections: option.ids.flatMap((id) => {
        const section = byId.get(id);
        return section === undefined ? [] : [section];
      }),
      fit: option.fit,
      seat: option.seat,
      ownCurriculum: option.ownCurriculum,
    }))
    .sort(
      (a, b) =>
        RANK[a.fit] - RANK[b.fit] ||
        SEAT_RANK[a.seat] - SEAT_RANK[b.seat] ||
        earliest(a.sections) - earliest(b.sections),
    );
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Whether marks were saved for this plan in its current term. */
function marksBelongTo(
  marks: ChecklistMarks | null,
  plan: Plan,
): marks is ChecklistMarks {
  return (
    marks?.planId === plan.id &&
    marks.year === plan.year &&
    marks.semester === plan.semester
  );
}

/** Derive the checklist rows of a plan from its kit, the student's marks, and the term. */
export function deriveChecklist(input: ChecklistInput): Checklist {
  const { plan, pageTerm } = input;
  const term: Term = { year: plan.year, semester: plan.semester };
  const kit =
    input.kit !== null && kitMatchesPlan(input.kit, plan) ? input.kit : null;
  const termMismatch = pageTerm !== null && !termsEqual(pageTerm, term);
  const marks = marksBelongTo(input.marks, plan) ? input.marks.marks : {};
  const page = termMismatch ? null : (input.page ?? null);
  const rows = groupEntriesBySubject(plan.entries).map(
    (group): ChecklistRow => {
      const meta = group.entries[0]?.snapshot.subjectMeta;
      const snapshots = group.entries.map((entry) => entry.snapshot);
      const subject = kit?.subjects.find(
        (item) => item.subjectId === group.subjectId,
      );
      const unread = kit?.unread.includes(group.subjectId) ?? false;
      const fromKit = subject === undefined ? [] : plannedSections(subject);
      const alternatives = subject === undefined ? [] : alternativesOf(subject);
      const mark = marks[group.subjectId];
      const chosen =
        mark?.state === 'addedOther' && mark.chosenIds !== undefined
          ? (alternatives.find((option) =>
              sameIds(option.ids, mark.chosenIds ?? []),
            ) ?? null)
          : null;
      const planned = fromKit.length > 0 ? fromKit : snapshots;
      const observed =
        page === null ? null : observeRow(page, group.subjectId, planned);
      const fromPage =
        observed === null
          ? 'notDone'
          : observed.state === 'listed' && observed.prerequisites.length > 0
            ? 'conditional'
            : OBSERVED_STATE[observed.state];
      const duplicateCodes = new Set(subject?.duplicateCodes ?? []);
      return {
        subjectId: group.subjectId,
        nameTh: subject?.nameTh ?? meta?.nameTh ?? '',
        nameEn: subject?.nameEn ?? meta?.nameEn ?? '',
        credit: subject?.credit ?? meta?.credit ?? 0,
        planned,
        alternatives,
        state: termMismatch ? 'termMismatch' : (mark?.state ?? fromPage),
        mark: mark?.state ?? null,
        observed,
        chosen,
        conditionsTh:
          subject === undefined ? [] : kitConditions(subject, 'rulesTh'),
        conditionsEn:
          subject === undefined ? [] : kitConditions(subject, 'rulesEn'),
        duplicateCode:
          planned.find((section) => duplicateCodes.has(section.section))
            ?.section ?? null,
        missing: unread || (subject !== undefined && fromKit.length === 0),
        plannedSeat:
          subject?.options.find((option) => option.planned)?.seat ?? null,
      };
    },
  );
  const plannedIds = new Set(rows.map((row) => row.subjectId));
  return {
    term,
    termMismatch,
    hasKit: kit !== null,
    rows,
    observed: page !== null,
    extras: page === null ? [] : pageExtras(page.observation, plannedIds),
    listedPlanned: rows.filter((row) => row.observed?.state === 'listed')
      .length,
    done: rows.filter((row) => !UNSETTLED.includes(row.state)).length,
    total: rows.length,
    credits: planCredits(plan.entries).credits,
  };
}

/** Whether a row differs from the plan, or needs the student's eyes before submitting. */
export type ReviewKind =
  'mismatch' | 'conditional' | 'checkCurriculum' | 'match';

const MISMATCH: readonly RowState[] = [
  'notDone',
  'addedOther',
  'skipped',
  'termMismatch',
  'refused',
  'notGranted',
  'notSubmitted',
];

export function reviewKind(row: ChecklistRow): ReviewKind {
  if (MISMATCH.includes(row.state)) return 'mismatch';
  if (row.state === 'conditional') return 'conditional';
  if (row.duplicateCode !== null) return 'checkCurriculum';
  return 'match';
}

const REVIEW_ORDER: Record<ReviewKind, number> = {
  mismatch: 0,
  conditional: 1,
  checkCurriculum: 2,
  match: 3,
};

/** The final review: rows that differ from the plan first, then those to check by eye. */
export function finalReview(
  checklist: Checklist,
): { row: ChecklistRow; kind: ReviewKind }[] {
  return checklist.rows
    .map((row) => ({ row, kind: reviewKind(row) }))
    .sort((a, b) => REVIEW_ORDER[a.kind] - REVIEW_ORDER[b.kind]);
}

/** Set or clear one mark, returning new marks for the plan and its term. */
export function withMark(
  current: ChecklistMarks | null,
  plan: Plan,
  subjectId: string,
  mark: ChecklistMark | null,
): ChecklistMarks {
  const base: ChecklistMarks = marksBelongTo(current, plan)
    ? current
    : { planId: plan.id, year: plan.year, semester: plan.semester, marks: {} };
  const marks = Object.fromEntries(
    Object.entries(base.marks).filter(([key]) => key !== subjectId),
  );
  if (mark !== null) marks[subjectId] = mark;
  return { ...base, marks };
}
