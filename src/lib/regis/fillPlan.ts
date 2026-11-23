// The pure decisions of a fill run (ADR-0078): what to fill for a planned subject, what
// stops it before it starts, which rendered option is provably the planned section,
// and the extra checks KCP adds because the host skips them. The engine reads the page,
// asks these functions, and acts on what they answer, so every stop reason is tested
// without a browser. The page never shows a teach table id, so identity is proved by
// uniqueness: the kit lists the planned code once for its subject and kind, exactly one
// option carries it, and any curriculum suffix on it is one the kit explains.

import {
  snapshotToSection,
  type Plan,
  type SectionSnapshot,
} from '../domain/plan';
import { checkPlacement } from '../planner/placement';
import type { ChecklistRow } from './checklist';
import type { HostObservation } from './hostObservation';
import type { RegistrationKit } from './kitSchema';
import { observeRow } from './observedRow';
import { plannedSubjectId, type PlannedSubjectId } from './plannedId';

/** Why a fill stopped, each with its own sentence and next step in the dock. */
export const STOP_REASONS = [
  'notReady',
  'termMismatch',
  'dialogOpen',
  'fieldNotEmpty',
  'listedOther',
  'refused',
  'notVisible',
  'practiceMissing',
  'duplicateCode',
  'full',
  'hostClash',
  'kcpClash',
  'listUnknown',
  'credits',
  'noAnswer',
  'pageChanged',
  'untestedBuild',
  'latched',
  'notRecognised',
  'noKit',
  'stopped',
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

/** The planned half of a section group the host offers in one select. */
export interface FillHalf {
  code: string;
  /** Whether the kit lists this code for the subject's other kind too. */
  shared: boolean;
  /** How many sections of this kind the kit lists for the subject. */
  listed: number;
}

export interface FillTarget {
  id: PlannedSubjectId;
  subjectId: string;
  credit: number;
  primary: FillHalf;
  practice: FillHalf | null;
  group: SectionSnapshot[];
}

/** What to fill for a checklist row, or why it cannot be filled from the kit. */
export function fillTarget(
  row: ChecklistRow,
  plan: Plan,
  kit: RegistrationKit | null,
): FillTarget | StopReason {
  const subject = kit?.subjects.find(
    (item) => item.subjectId === row.subjectId,
  );
  const id = kit === null ? null : plannedSubjectId(row.subjectId, plan, kit);
  if (subject === undefined || id === null || row.missing) return 'noKit';
  if (row.duplicateCode !== null) return 'duplicateCode';
  const lecture = row.planned.find((section) => section.kind === 'lecture');
  const practice = row.planned.find((section) => section.kind === 'practice');
  const primary = lecture ?? practice;
  if (primary === undefined) return 'noKit';
  const half = (section: SectionSnapshot): FillHalf => ({
    code: section.section,
    shared: subject.sections.some(
      (other) =>
        other.section === section.section && other.kind !== section.kind,
    ),
    listed: subject.sections.filter((other) => other.kind === section.kind)
      .length,
  });
  return {
    id,
    subjectId: row.subjectId,
    credit: row.credit,
    primary: half(primary),
    practice:
      lecture !== undefined && practice !== undefined ? half(practice) : null,
    group: row.planned,
  };
}

/** What stops any fill on this page before a subject is touched, or null. */
export function pageBlock(
  observation: HostObservation | null,
  plan: Plan,
): StopReason | null {
  if (observation === null) return 'notRecognised';
  if (observation.step !== 2 || observation.card === null) return 'notReady';
  const { term } = observation;
  if (term?.year !== plan.year || term.semester !== plan.semester) {
    return 'termMismatch';
  }
  if (
    observation.dialog !== null &&
    observation.dialog.kind !== 'gradeNotAnnounced'
  ) {
    return 'dialogOpen';
  }
  return null;
}

/** Whether the page list holds the planned group half for half, as the checklist reads it. */
export function listedState(
  observation: HostObservation,
  target: FillTarget,
): 'absent' | 'listed' | 'other' {
  const state = observeRow(
    { observation, conditional: {} },
    target.subjectId,
    target.group,
  )?.state;
  return state === 'listed'
    ? 'listed'
    : state === 'listedOther'
      ? 'other'
      : 'absent';
}

/**
 * The option that is provably the planned half, or why KCP may not choose. A code the
 * page shows twice, or with a suffix the kit cannot explain, is the duplicate code stop;
 * a code missing from a list the page cut at 20 is not visible rather than not offered.
 */
export function pickOption(
  options: readonly { section: string; curriculum: string | null }[],
  half: FillHalf,
): number | StopReason {
  const matches = options.flatMap((option, index) =>
    option.section === half.code ? [index] : [],
  );
  const index = matches[0];
  if (matches.length > 1) return 'duplicateCode';
  if (index === undefined) {
    return options.length >= 20 && half.listed > options.length
      ? 'notVisible'
      : 'refused';
  }
  if (options[index]?.curriculum !== null && !half.shared)
    return 'duplicateCode';
  return index;
}

/** Whether more students applied than the section seats, the pause owner answer 4A asks. */
export function overSubscribed(observation: HostObservation): boolean {
  const seats = observation.card?.seats;
  return (
    seats !== null &&
    seats !== undefined &&
    seats.limit !== null &&
    seats.limit > 0 &&
    seats.count >= seats.limit
  );
}

/**
 * KCP's own clash check of the planned group against the subjects on the page list,
 * because the host never checks the lecture of a free pair. Each list row must resolve
 * to one kit section by subject, code and kind; a row it cannot resolve is a stop
 * rather than a guess.
 */
export function listClash(
  observation: HostObservation,
  target: FillTarget,
  kit: RegistrationKit,
): StopReason | null {
  const placed: SectionSnapshot[] = [];
  for (const row of observation.list ?? []) {
    const found = (
      kit.subjects.find((item) => item.subjectId === row.subjectId)?.sections ??
      []
    ).filter(
      (section) =>
        section.section === row.section &&
        (row.kind === null || section.kind === row.kind),
    );
    const section = found.length === 1 ? found[0] : undefined;
    if (section === undefined) return 'listUnknown';
    placed.push(section);
  }
  const result = checkPlacement(
    placed.map(snapshotToSection),
    target.group.map(snapshotToSection),
  );
  return result.ok ? null : 'kcpClash';
}

/** Whether adding the subject would take the page total past its credit limit. */
export function overCredits(
  observation: HostObservation,
  target: FillTarget,
): boolean {
  const credits = observation.credits;
  return (
    credits?.total !== null &&
    credits?.total !== undefined &&
    credits.max !== null &&
    credits.total + target.credit > credits.max
  );
}
