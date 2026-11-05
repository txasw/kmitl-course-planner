// Search the current result for conflict free curriculum timetables. Only the
// curriculum subjects of the result are candidates; GenEd and free electives stay
// the student's own choice, and the entries already in the active plan are kept as
// fixed constraints. The hard rules are exactly the add rules: a section group
// joins only when checkPlacement accepts it, so time, exam, pair, and duplicate
// subject rules match the add path, and a full or closed section is never chosen.
//
// The search is exhaustive depth first over the courses with the fewest options
// first, each course taking one of its section groups or being skipped. Every rule
// checkPlacement applies is between two sections, so each group is checked once
// against the locked entries and the rest is a memoized pairwise compatibility
// table. Branch and bound prunes a subtree whose best reachable objective, and for
// a tie its least reachable penalty, cannot beat the worst timetable kept. A node
// cap bounds the work on a large result and marks the outcome truncated.
//
// A timetable is kept only when it is maximal: a skipped course that still has a
// fitting section would make a strictly better timetable, so leaving it out is
// never offered.

import type { Course, Meeting, Section } from '../domain/types';
import type { PlanEntry } from '../domain/plan';
import { summarizeCredits } from './credits';
import { checkPlacement } from './placement';
import {
  suggestCandidates,
  type SuggestCandidate,
  type SuggestChoice,
  type SuggestOption,
} from './suggestCandidates';
import {
  bySubject,
  compareObjective,
  compareRanked,
  objectiveValue,
  type RankedTimetable,
  type SuggestObjective,
} from './suggestRank';
import { leftOutReason, type LeftOutReason } from './suggestReasons';
import {
  penaltyLowerBound,
  preferencePenalty,
  timetableStats,
  type SuggestPreference,
  type TimetableStats,
} from './suggestScore';
import { placedSections } from './transaction';

/** How many suggestions a search returns by default. */
export const SUGGEST_LIMIT = 3;

/** The search nodes visited before a search stops and reports truncated. */
export const SUGGEST_NODE_CAP = 200_000;

export interface SuggestInput {
  /** The courses of the current result; only curriculum courses are candidates. */
  courses: readonly Course[];
  /** The entries of the active plan, kept as fixed constraints. */
  locked: readonly PlanEntry[];
  objective: SuggestObjective;
  preference: SuggestPreference;
  limit?: number;
  nodeCap?: number;
}

export interface LeftOutCourse {
  course: Course;
  reason: LeftOutReason;
}

/** The whole timetable a suggestion produces, locked entries included. */
export interface SuggestStats extends TimetableStats {
  credits: number;
  courses: number;
}

export interface Suggestion {
  /** The chosen curriculum courses, by subject id. */
  choices: SuggestChoice[];
  stats: SuggestStats;
  penalty: number;
  /** Every curriculum candidate not chosen, by subject id, with the reason. */
  leftOut: LeftOutCourse[];
}

export interface SuggestResult {
  suggestions: Suggestion[];
  truncated: boolean;
  nodes: number;
}

/** A memoized pairwise compatibility check over the numbered options. */
function compatibilityTable(
  optionCount: number,
): (a: SuggestOption, b: SuggestOption) => boolean {
  const table = new Int8Array(optionCount * optionCount);
  return (a, b) => {
    const at = a.index * optionCount + b.index;
    if (table[at] === 0) {
      const fits = checkPlacement(a.choice.group, b.choice.group).ok ? 1 : 2;
      table[at] = fits;
      table[b.index * optionCount + a.index] = fits;
    }
    return table[at] === 1;
  };
}

/** Run the bounded search and return the best timetables, best first. */
export function suggestPlans(input: SuggestInput): SuggestResult {
  const limit = input.limit ?? SUGGEST_LIMIT;
  const nodeCap = input.nodeCap ?? SUGGEST_NODE_CAP;
  const locked = placedSections([...input.locked]);
  // The locked meetings followed by the chosen ones, grown and shrunk with the
  // search so a bound or a leaf never rebuilds it.
  const meetings: Meeting[] = locked.flatMap((section) => section.meetings);
  const candidates = suggestCandidates(input.courses, input.locked, locked);
  const active = candidates
    .filter((candidate) => candidate.options.length > 0)
    .sort((a, b) => a.options.length - b.options.length || bySubject(a, b));
  const compatible = compatibilityTable(
    active.reduce((count, candidate) => count + candidate.options.length, 0),
  );

  // The courses and credits still open from each depth, the bound's optimism.
  const remainingCourses = active.map((_, depth) => active.length - depth);
  const remainingCredits = active.map((_, depth) =>
    active
      .slice(depth)
      .reduce((credits, candidate) => credits + candidate.course.credit, 0),
  );

  const kept: RankedTimetable[] = [];
  const chosen: SuggestOption[] = [];
  const skipped: SuggestCandidate[] = [];
  let chosenCredits = 0;
  let nodes = 0;
  let truncated = false;

  const fitsChosen = (option: SuggestOption): boolean =>
    chosen.every((other) => compatible(other, option));
  const worstKept = (): RankedTimetable | undefined =>
    kept.length >= limit ? kept[kept.length - 1] : undefined;

  const keepLeaf = (): void => {
    const ranked: RankedTimetable = {
      objective: objectiveValue(input.objective, chosen.length, chosenCredits),
      penalty: preferencePenalty(meetings, input.preference),
      choices: chosen.map((option) => option.choice).sort(bySubject),
    };
    const bar = worstKept();
    if (bar !== undefined && compareRanked(ranked, bar) >= 0) {
      return;
    }
    if (skipped.some((candidate) => candidate.options.some(fitsChosen))) {
      return;
    }
    kept.push(ranked);
    kept.sort(compareRanked);
    kept.length = Math.min(kept.length, limit);
  };

  const cannotImprove = (depth: number): boolean => {
    const bar = worstKept();
    if (bar === undefined) {
      return false;
    }
    const best = objectiveValue(
      input.objective,
      chosen.length + (remainingCourses[depth] ?? 0),
      chosenCredits + (remainingCredits[depth] ?? 0),
    );
    const order = compareObjective(best, bar.objective);
    if (order !== 0) {
      return order < 0;
    }
    return penaltyLowerBound(meetings, input.preference) > bar.penalty;
  };

  const visit = (depth: number): void => {
    nodes += 1;
    if (nodes > nodeCap) {
      truncated = true;
      return;
    }
    const candidate = active[depth];
    if (candidate === undefined) {
      keepLeaf();
      return;
    }
    if (cannotImprove(depth)) {
      return;
    }
    for (const option of candidate.options) {
      if (truncated) {
        return;
      }
      if (fitsChosen(option)) {
        const mark = meetings.length;
        chosen.push(option);
        meetings.push(
          ...option.choice.group.flatMap((member) => member.meetings),
        );
        chosenCredits += candidate.course.credit;
        visit(depth + 1);
        chosen.pop();
        meetings.length = mark;
        chosenCredits -= candidate.course.credit;
      }
    }
    if (truncated) {
      return;
    }
    skipped.push(candidate);
    visit(depth + 1);
    skipped.pop();
  };

  visit(0);

  return {
    suggestions: kept.map((ranked) =>
      toSuggestion(ranked, input.locked, locked, candidates),
    ),
    truncated,
    nodes: Math.min(nodes, nodeCap),
  };
}

function toSuggestion(
  ranked: RankedTimetable,
  lockedEntries: readonly PlanEntry[],
  locked: Section[],
  candidates: SuggestCandidate[],
): Suggestion {
  const chosenSubjects = new Set(
    ranked.choices.map((choice) => choice.course.subjectId),
  );
  const placed = [...locked, ...ranked.choices.flatMap((c) => c.group)];
  const credits = summarizeCredits([
    ...lockedEntries.map((entry) => ({
      subjectId: entry.subjectId,
      credit: entry.snapshot.subjectMeta.credit,
    })),
    ...ranked.choices.map((choice) => ({
      subjectId: choice.course.subjectId,
      credit: choice.course.credit,
    })),
  ]);
  const leftOut = candidates
    .filter((candidate) => !chosenSubjects.has(candidate.course.subjectId))
    .map((candidate) => ({
      course: candidate.course,
      reason: leftOutReason(candidate.open, locked, placed),
    }))
    .sort(bySubject);
  return {
    choices: ranked.choices,
    stats: {
      ...timetableStats(placed.flatMap((section) => section.meetings)),
      credits: credits.credits,
      courses: credits.subjects,
    },
    penalty: ranked.penalty,
    leftOut,
  };
}
