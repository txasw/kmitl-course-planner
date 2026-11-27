// The registration checklist: one row per planned subject, its planned section group, the
// other groups from the kit, the group the student chose for this registration, and what
// the read only observer saw on the page while it is healthy (ADR-0077), which is the
// only source of a row's state. The derivation is one pure function, so the helper and
// the tests read the same states. A plan of another term than the page, a kit of another
// term than the plan, and choices saved for another term are never mixed in: a kit or a
// choice of another term is ignored, and a page term that differs puts every row in the
// term mismatch state. A kit past the age limit may stand in for display only: the rows
// then show its other groups and the student's chosen one, while the checklist says no
// fresh kit backs them, so nothing that fills reads it.

import type { Plan, SectionSnapshot } from '../domain/plan';
import { groupEntriesBySubject } from '../planner/subjectGroups';
import { termsEqual, type Term } from '../routing/academicTerms';
import { choicesBelongTo, type SectionChoices } from './choices';
import { groupConditions, kitMatchesPlan, plannedSections } from './kit';
import {
  observeRow,
  pageExtras,
  type ObservedPage,
  type ObservedRow,
  type ObservedState,
} from './observedRow';
import type { KitFit, KitSeat, KitSubject, RegistrationKit } from './kitSchema';

export type RowState =
  | 'notDone'
  | 'added'
  | 'addedOther'
  | 'conditional'
  | 'termMismatch'
  | 'refused'
  | 'submitted'
  | 'granted'
  | 'notGranted'
  | 'notGrantedCondition'
  | 'notSubmitted';

/** The row state each page reading stands for. */
const OBSERVED_STATE: Record<ObservedState, RowState> = {
  notListed: 'notDone',
  listed: 'added',
  listedOther: 'addedOther',
  refused: 'refused',
  waiting: 'submitted',
  granted: 'granted',
  notGranted: 'notGranted',
  notGrantedCondition: 'notGrantedCondition',
  notSubmitted: 'notSubmitted',
};

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
  /** What the page shows for the subject while the observer is healthy, or null. */
  observed: ObservedRow | null;
  /** The other group the student chose for this registration, or null for the plan's. */
  chosen: RowAlternative | null;
  /** The conditions printed for the group this registration uses, in each language. */
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
  /** Subjects the page lists that the plan does not hold. */
  extras: { subjectId: string; codes: string[] }[];
  /** Planned subjects the page lists with their planned group. */
  listedPlanned: number;
  total: number;
}

export interface ChecklistInput {
  plan: Plan;
  /** A kit already checked for age by the caller, or null. */
  kit: RegistrationKit | null;
  /**
   * A kit past the age limit, shown only while no fresh kit exists: its groups fill the
   * rows for display, and `hasKit` stays false.
   */
  staleKit?: RegistrationKit | null;
  choices: SectionChoices | null;
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

/** Derive the checklist rows of a plan from its kit, the student's choices, and the page. */
export function deriveChecklist(input: ChecklistInput): Checklist {
  const { plan, pageTerm } = input;
  const term: Term = { year: plan.year, semester: plan.semester };
  const fresh =
    input.kit !== null && kitMatchesPlan(input.kit, plan) ? input.kit : null;
  const older = input.staleKit ?? null;
  const kit =
    fresh ?? (older !== null && kitMatchesPlan(older, plan) ? older : null);
  const termMismatch = pageTerm !== null && !termsEqual(pageTerm, term);
  const choices = choicesBelongTo(input.choices, plan)
    ? input.choices.choices
    : {};
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
      const choice = choices[group.subjectId];
      const chosen =
        choice === undefined
          ? null
          : (alternatives.find((option) => sameIds(option.ids, choice)) ??
            null);
      const planned = fromKit.length > 0 ? fromKit : snapshots;
      const used = chosen?.sections ?? planned;
      const conditionsTh = groupConditions(used, 'rulesTh');
      const conditionsEn = groupConditions(used, 'rulesEn');
      // The page is read against the group this registration uses, so a chosen group
      // the page lists counts as added as intended.
      const observed =
        page === null ? null : observeRow(page, group.subjectId, used);
      // A subject listed with a prerequisite the page named, or with conditions printed
      // for its group, is added on a condition (design C2, rule 4.2).
      const conditional =
        (observed?.prerequisites.length ?? 0) > 0 ||
        conditionsTh.length > 0 ||
        conditionsEn.length > 0;
      const fromPage =
        observed === null
          ? 'notDone'
          : observed.state === 'listed' && conditional
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
        state: termMismatch ? 'termMismatch' : fromPage,
        observed,
        chosen,
        conditionsTh,
        conditionsEn,
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
    hasKit: fresh !== null,
    rows,
    extras: page === null ? [] : pageExtras(page.observation, plannedIds),
    listedPlanned: rows.filter((row) => row.observed?.state === 'listed')
      .length,
    total: rows.length,
  };
}

/** The kit group the page lists for a subject listed with another section, if known. */
export function listedGroup(row: ChecklistRow): RowAlternative | null {
  const codes = [...(row.observed?.codes ?? [])].sort().join(' ');
  return (
    row.alternatives.find(
      (option) =>
        option.sections
          .map((section) => section.section)
          .sort()
          .join(' ') === codes,
    ) ?? null
  );
}

/**
 * The sections a row names. A subject the page lists with another section names the
 * group the page lists, when the kit knows it, since that is what the student registers;
 * every other row names the group chosen for this registration, else the planned one.
 */
export function shownSections(
  row: ChecklistRow,
  listedOther: boolean,
): SectionSnapshot[] {
  const listed = listedOther ? listedGroup(row) : null;
  return listed?.sections ?? row.chosen?.sections ?? row.planned;
}
