// What the pre registration page shows for one planned subject, read by the observer
// (ADR-0077): on the choose subjects step whether the subject is on the host list with
// the planned section group, with another one, refused by a toast, or not there yet;
// on the complete step whether it was submitted and what the host decided. Matching is
// by subject id, section code, and lecture or practice, because the page never shows a
// teach table id. The page is the authority on the day, so nothing here edits the plan.

import type { SectionSnapshot } from '../domain/plan';
import type { HostObservation } from './hostObservation';

/** What the checklist reads from the page: the observation and the conditional ids. */
export interface ObservedPage {
  observation: HostObservation;
  /** Prerequisite ids per planned subject the grade not announced dialog named. */
  conditional: Readonly<Record<string, readonly string[]>>;
}

export type ObservedState =
  | 'notListed'
  | 'listed'
  | 'listedOther'
  | 'refused'
  | 'waiting'
  | 'granted'
  | 'notGranted'
  | 'notGrantedCondition'
  | 'notSubmitted';

export interface ObservedRow {
  state: ObservedState;
  /** The section codes the page holds for the subject. */
  codes: string[];
  /** Prerequisite ids the grade not announced dialog named, or empty. */
  prerequisites: readonly string[];
}

interface PageSection {
  section: string;
  kind: 'lecture' | 'practice' | null;
}

/** Whether the page holds exactly the planned group, half for half. */
function sameGroup(
  rows: readonly PageSection[],
  planned: readonly SectionSnapshot[],
): boolean {
  if (rows.length !== planned.length) return false;
  const left = [...planned];
  return rows.every((row) => {
    const index = left.findIndex(
      (section) =>
        section.section === row.section &&
        (row.kind === null || section.kind === row.kind),
    );
    if (index < 0) return false;
    left.splice(index, 1);
    return true;
  });
}

function resultState(rows: readonly { result: string }[]): ObservedState {
  if (rows.length === 0) return 'notSubmitted';
  const has = (result: string) => rows.some((row) => row.result === result);
  if (has('notGrantedCondition')) return 'notGrantedCondition';
  if (has('notGranted')) return 'notGranted';
  return rows.every((row) => row.result === 'granted') ? 'granted' : 'waiting';
}

/** The page's state for a planned subject, or null when the page shows no list. */
export function observeRow(
  page: ObservedPage,
  subjectId: string,
  planned: readonly SectionSnapshot[],
): ObservedRow | null {
  const { observation } = page;
  const prerequisites = page.conditional[subjectId] ?? [];
  const mine = <T extends { subjectId: string }>(rows: readonly T[]) =>
    rows.filter((row) => row.subjectId === subjectId);
  if (observation.results !== null) {
    const results = mine(observation.results);
    const codes = results.map((row) => row.section);
    return { state: resultState(results), codes, prerequisites };
  }
  if (observation.list === null) return null;
  const rows = mine(observation.list);
  const codes = rows.map((row) => row.section);
  if (rows.length > 0) {
    return {
      state: sameGroup(rows, planned) ? 'listed' : 'listedOther',
      codes,
      prerequisites,
    };
  }
  const refused = observation.toasts.some(
    (toast) => toast.kind === 'refused' && toast.subjectId === subjectId,
  );
  return { state: refused ? 'refused' : 'notListed', codes, prerequisites };
}

/** Subjects the page lists that the plan does not hold, with their section codes. */
export function pageExtras(
  observation: HostObservation,
  plannedIds: ReadonlySet<string>,
): { subjectId: string; codes: string[] }[] {
  const extras = new Map<string, string[]>();
  for (const row of observation.results ?? observation.list ?? []) {
    if (plannedIds.has(row.subjectId)) continue;
    extras.set(row.subjectId, [
      ...(extras.get(row.subjectId) ?? []),
      row.section,
    ]);
  }
  return [...extras].map(([subjectId, codes]) => ({ subjectId, codes }));
}
