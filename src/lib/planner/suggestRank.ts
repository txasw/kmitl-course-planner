// The order plan suggestions are ranked in. The objective comes first: coverAll
// prefers more curriculum courses and then more credits, maxCredits the reverse.
// A tie on the objective goes to the lower preference penalty, and a tie on both
// to the chosen set that sorts first by subject id and then by section code, so
// the ranking is a total order and the same input always ranks the same way.

import type { Course, Section } from '../domain/types';
import type { SuggestChoice } from './suggestCandidates';

/** The objectives in the order the suggestion dialog offers them. */
export const SUGGEST_OBJECTIVES = ['coverAll', 'maxCredits'] as const;

/** coverAll ranks by curriculum courses, then credits; maxCredits the reverse. */
export type SuggestObjective = (typeof SUGGEST_OBJECTIVES)[number];

/** The objective as a pair compared left to right, higher is better. */
export type ObjectiveValue = [number, number];

export interface RankedTimetable {
  objective: ObjectiveValue;
  penalty: number;
  /** The chosen courses, by subject id. */
  choices: SuggestChoice[];
}

export function objectiveValue(
  objective: SuggestObjective,
  courses: number,
  credits: number,
): ObjectiveValue {
  return objective === 'coverAll' ? [courses, credits] : [credits, courses];
}

/** Positive when a is the better objective. */
export function compareObjective(a: ObjectiveValue, b: ObjectiveValue): number {
  return a[0] - b[0] || a[1] - b[1];
}

export function bySubject(
  a: { course: Course },
  b: { course: Course },
): number {
  return a.course.subjectId.localeCompare(b.course.subjectId);
}

function bySection(a: Section, b: Section): number {
  return a.section.localeCompare(b.section, undefined, { numeric: true });
}

function compareChoices(a: SuggestChoice[], b: SuggestChoice[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const x = a[i];
    const y = b[i];
    if (x !== undefined && y !== undefined) {
      const order = bySubject(x, y) || bySection(x.section, y.section);
      if (order !== 0) {
        return order;
      }
    }
  }
  return a.length - b.length;
}

/** Negative when a ranks before b. */
export function compareRanked(a: RankedTimetable, b: RankedTimetable): number {
  return (
    compareObjective(b.objective, a.objective) ||
    a.penalty - b.penalty ||
    compareChoices(a.choices, b.choices)
  );
}
