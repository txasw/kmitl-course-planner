// Credit totals for a plan. A subject contributes its credit once even when both
// its lecture and practice sections are placed, so the calculator counts distinct
// subjects. It takes plain subject and credit pairs rather than the plan type, so
// it stays independent of how a plan stores its entries. The weekly hours the credit
// notation states follow the same rule, since both halves of a pair carry one notation.

import { parseCreditLps } from '../parsing/creditLps';
import type { Semester } from '../routing/academicTerms';

export interface CreditedSubject {
  subjectId: string;
  credit: number;
}

export interface CreditSummary {
  credits: number;
  subjects: number;
}

/** Total credits and distinct subject count, counting each subject once. */
export function summarizeCredits(subjects: CreditedSubject[]): CreditSummary {
  const creditBySubject = new Map<string, number>();
  for (const subject of subjects) {
    if (!creditBySubject.has(subject.subjectId)) {
      creditBySubject.set(subject.subjectId, subject.credit);
    }
  }
  let credits = 0;
  for (const credit of creditBySubject.values()) {
    credits += credit;
  }
  return { credits, subjects: creditBySubject.size };
}

/** Total credits across distinct subjects. */
export function totalCredits(subjects: CreditedSubject[]): number {
  return summarizeCredits(subjects).credits;
}

export interface HourlySubject {
  subjectId: string;
  /** The credit notation, for example `3(2-3-6)`. */
  creditStr: string;
}

export interface WeeklyHours {
  lecture: number;
  practice: number;
  selfStudy: number;
  /** Distinct subjects whose notation states no hours, left out of the sums. */
  unstated: number;
}

/**
 * The weekly lecture, practice, and self study hours the plan's credit notations state,
 * counting each subject once as the credit total does. A subject whose notation does not
 * parse is counted apart, so a summary can say its sums leave that subject out rather
 * than read low with no reason.
 */
export function summarizeWeeklyHours(
  subjects: readonly HourlySubject[],
): WeeklyHours {
  const notationBySubject = new Map<string, string>();
  for (const subject of subjects) {
    if (!notationBySubject.has(subject.subjectId)) {
      notationBySubject.set(subject.subjectId, subject.creditStr);
    }
  }
  const sums: WeeklyHours = {
    lecture: 0,
    practice: 0,
    selfStudy: 0,
    unstated: 0,
  };
  for (const notation of notationBySubject.values()) {
    const hours = parseCreditLps(notation);
    if (hours === null) {
      sums.unstated += 1;
    } else {
      sums.lecture += hours.lecture;
      sums.practice += hours.practice;
      sums.selfStudy += hours.selfStudy;
    }
  }
  return sums;
}

export interface CreditRange {
  /** The fewest credits of the usual load, or null when the term sets no minimum. */
  min: number | null;
  max: number;
}

// The usual credit load per semester from clause 14.4 of the KMITL undergraduate
// regulation B.E. 2565. Semesters 1 and 2 are the regular semesters. Semester 3 is the
// special term, read as such from the API, which the regulation caps with no minimum.
// The load is advisory here: final year students and loads the Academic Council approves
// may fall outside it, so leaving the range is a note and never a block.
export const CREDIT_RANGE: Readonly<Record<Semester, CreditRange>> = {
  '1': { min: 9, max: 22 },
  '2': { min: 9, max: 22 },
  '3': { min: null, max: 9 },
};

export type CreditLoad =
  | { kind: 'within' }
  | { kind: 'below'; min: number }
  | { kind: 'above'; max: number };

/**
 * Where a credit total sits against the usual load of its semester. A plan with no
 * entries is never below the range, so an empty plan carries no note.
 */
export function creditLoad(
  credits: number,
  semester: Semester,
  entryCount: number,
): CreditLoad {
  const range = CREDIT_RANGE[semester];
  if (credits > range.max) {
    return { kind: 'above', max: range.max };
  }
  if (entryCount > 0 && range.min !== null && credits < range.min) {
    return { kind: 'below', min: range.min };
  }
  return { kind: 'within' };
}
