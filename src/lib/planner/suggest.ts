// Search the current result for conflict free timetables. Only the subjects the
// student ticked are candidates, the plan's subjects and the curriculum subjects by
// default. A ticked subject already in the plan is in every timetable, at its own
// section group or at another open one of the result's course, so a suggestion can
// rearrange the plan around what it adds; an unticked one is left out. The hard
// rules are exactly the add rules: a section group joins only when checkPlacement
// accepts it, so time, exam, pair, and duplicate subject rules match the add path,
// and a full or closed section is never chosen. The plan's own group is the one
// exception, since keeping it adds nothing.
//
// The search is exhaustive depth first over the courses with the fewest options
// first, each course taking one of its section groups or, unless it is a ticked
// plan subject, being skipped. Every rule checkPlacement applies is between two
// sections, so the checks are a memoized pairwise compatibility table. Branch and
// bound prunes a subtree whose best reachable objective, and for a tie its least
// reachable penalty, cannot beat the worst timetable kept. A node cap bounds the
// work on a large result and marks the outcome truncated.
//
// A timetable is kept only when it is maximal: a skipped course that still has a
// fitting section would make a strictly better timetable, so leaving it out is
// never offered. A timetable that moves plan subjects is kept only when every move
// gains something: if putting any of the moved subjects back at their own groups
// still fits and scores no worse, the moves only reshuffle the plan, so it is
// never offered. Moving changes neither the courses nor the credits, so the gain
// is either room for an added course or a lower penalty. No two kept timetables
// share a time footprint: a timetable that only swaps a section for another
// meeting at the same times is the same week, so it takes the place of its twin
// only when it ranks first, and the suggestions differ in at least one meeting
// time or subject.

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
  type RankedOrder,
  type RankedTimetable,
  type SuggestObjective,
} from './suggestRank';
import { keepDistinct, timetableFootprint } from './suggestFootprint';
import { leftOutReason, type LeftOutReason } from './suggestReasons';
import {
  penaltyLowerBound,
  preferencePenalty,
  timetableStats,
  type SuggestPreference,
  type TimetableStats,
} from './suggestScore';
import { defaultSuggestSubjects, plannedSubjects } from './suggestSubjects';

/** How many suggestions a search returns by default. */
export const SUGGEST_LIMIT = 3;

/** The search nodes visited before a search stops and reports truncated. */
export const SUGGEST_NODE_CAP = 200_000;

export interface SuggestInput {
  /** The courses of the current result; only the ticked ones are candidates. */
  courses: readonly Course[];
  /** The ticked subject ids; the plan's and the group 2 subjects when omitted. */
  subjects?: ReadonlySet<string>;
  /** The entries of the active plan; its ticked subjects join every timetable. */
  entries: readonly PlanEntry[];
  objective: SuggestObjective;
  preference: SuggestPreference;
  limit?: number;
  nodeCap?: number;
}

export interface LeftOutCourse {
  course: Course;
  reason: LeftOutReason;
}

/** The whole timetable a suggestion produces, the kept plan subjects included. */
export interface SuggestStats extends TimetableStats {
  credits: number;
  courses: number;
}

export interface Suggestion {
  /** The chosen courses, by subject id, the kept plan subjects included. */
  choices: SuggestChoice[];
  stats: SuggestStats;
  penalty: number;
  /** Every ticked candidate not chosen, by subject id, with the reason. */
  leftOut: LeftOutCourse[];
  /** The plan entries the search ran against, so a stale apply is refused. */
  planIds: string[];
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
  // The chosen meetings, grown and shrunk with the search so a bound or a leaf
  // never rebuilds them.
  const meetings: Meeting[] = [];
  const subjects =
    input.subjects ?? defaultSuggestSubjects(input.courses, input.entries);
  const candidates = suggestCandidates(
    input.courses,
    subjects,
    plannedSubjects(input.courses, input.entries),
  );
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

  let kept: RankedTimetable[] = [];
  const chosen: SuggestOption[] = [];
  const skipped: SuggestCandidate[] = [];
  let chosenCredits = 0;
  let moved = 0;
  let nodes = 0;
  let truncated = false;

  // Each move option of a ticked plan subject, mapped to the subject's own group,
  // which plannedChoices lists first.
  const ownOf = new Map<number, SuggestOption>();
  for (const candidate of active) {
    const [own, ...moves] = candidate.options;
    if (candidate.required && own !== undefined) {
      for (const move of moves) {
        ownOf.set(move.index, own);
      }
    }
  }

  const fitsChosen = (option: SuggestOption): boolean =>
    chosen.every((other) => compatible(other, option));

  // Whether putting some of the leaf's moved subjects back at their own groups
  // still fits and scores no worse, so the moves gain nothing. Every subset is
  // tried, since two moves can depend on each other; a leaf moves few subjects.
  const movesGainNothing = (penalty: number): boolean => {
    const movedAt = chosen.flatMap((option, at) =>
      ownOf.has(option.index) ? [at] : [],
    );
    for (let mask = 1; mask < 1 << movedAt.length; mask += 1) {
      const undone = [...chosen];
      movedAt.forEach((at, bit) => {
        const own = ownOf.get(chosen[at]?.index ?? -1);
        if ((mask & (1 << bit)) !== 0 && own !== undefined) {
          undone[at] = own;
        }
      });
      const fits = undone.every((option, at) =>
        undone.every((other, from) => from <= at || compatible(option, other)),
      );
      if (
        fits &&
        preferencePenalty(
          undone.flatMap((option) =>
            option.choice.group.flatMap((member) => member.meetings),
          ),
          input.preference,
        ) <= penalty
      ) {
        return true;
      }
    }
    return false;
  };
  const worstKept = (): RankedTimetable | undefined =>
    kept.length >= limit ? kept[kept.length - 1] : undefined;

  const keepLeaf = (): void => {
    const order: RankedOrder = {
      objective: objectiveValue(input.objective, chosen.length, chosenCredits),
      penalty: preferencePenalty(meetings, input.preference),
      moved,
      choices: chosen.map((option) => option.choice).sort(bySubject),
    };
    const bar = worstKept();
    if (bar !== undefined && compareRanked(order, bar) >= 0) {
      return;
    }
    if (skipped.some((candidate) => candidate.options.some(fitsChosen))) {
      return;
    }
    if (moved > 0 && movesGainNothing(order.penalty)) {
      return;
    }
    // The footprint is built only for a leaf that would be kept, since most leaves
    // of a large search fall below the bar.
    kept = keepDistinct(
      kept,
      { ...order, footprint: timetableFootprint(order.choices) },
      limit,
    );
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
        const move = candidate.required && !option.choice.current ? 1 : 0;
        chosen.push(option);
        meetings.push(
          ...option.choice.group.flatMap((member) => member.meetings),
        );
        chosenCredits += candidate.course.credit;
        moved += move;
        visit(depth + 1);
        chosen.pop();
        meetings.length = mark;
        chosenCredits -= candidate.course.credit;
        moved -= move;
      }
    }
    // A ticked plan subject is never skipped, so a timetable always holds it.
    if (truncated || candidate.required) {
      return;
    }
    skipped.push(candidate);
    visit(depth + 1);
    skipped.pop();
  };

  visit(0);

  return {
    suggestions: kept.map((ranked) =>
      toSuggestion(
        ranked,
        candidates,
        input.entries.map((entry) => entry.teachTableId),
      ),
    ),
    truncated,
    nodes: Math.min(nodes, nodeCap),
  };
}

function toSuggestion(
  ranked: RankedTimetable,
  candidates: SuggestCandidate[],
  planIds: string[],
): Suggestion {
  const chosenSubjects = new Set(
    ranked.choices.map((choice) => choice.course.subjectId),
  );
  const placed = ranked.choices.flatMap((choice) => choice.group);
  // A left out course that clashes with a plan subject the timetable keeps at its
  // own group names that subject, since unticking it is the student's call. A
  // moved subject is not the current plan's section, so it is never named as one.
  const kept: Section[] = ranked.choices
    .filter((choice) => choice.current)
    .flatMap((choice) => choice.group);
  const credits = summarizeCredits(
    ranked.choices.map((choice) => ({
      subjectId: choice.course.subjectId,
      credit: choice.course.credit,
    })),
  );
  const leftOut = candidates
    .filter((candidate) => !chosenSubjects.has(candidate.course.subjectId))
    .map((candidate) => ({
      course: candidate.course,
      reason: leftOutReason(candidate.open, kept, placed),
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
    planIds,
  };
}
