// The courses a plan suggestion may choose from, and the section groups each can
// take. A candidate is a course of the current result whose subject the student
// ticked, or a ticked subject already in the plan. Its options are the distinct
// section groups, a section with its declared pair, whose members are all open; a
// full or closed section is never an option, and groups that are interchangeable by
// time and exam collapse to the lowest section code. A subject already in the plan
// is required, since the student ticked it to keep it, and its options open with the
// plan's own group, kept as it is, followed by the open groups of the result's course
// that meet at other times or sit other exams, so a suggestion may move it to make
// room. The open groups are kept as well, so a course with no option can still say
// why it was left out.

import { isSelectable } from '../catalog/seatStatus';
import type { Course, Section } from '../domain/types';
import { expandSectionGroup } from './placement';
import { collapseInterchangeable, interchangeable } from './suggestFootprint';
import type { PlannedSubject } from './suggestSubjects';

/** One chosen course: the section to add and the group the add places with it. */
export interface SuggestChoice {
  course: Course;
  section: Section;
  group: Section[];
  /** Whether the group is the plan's own, which applying keeps as it is. */
  current: boolean;
}

/** A choice with a dense index across every candidate, for the search's tables. */
export interface SuggestOption {
  index: number;
  choice: SuggestChoice;
}

export interface SuggestCandidate {
  course: Course;
  /** A ticked subject already in the plan, which every suggestion holds. */
  required: boolean;
  /** Open section groups of a result course; none for a required subject. */
  open: Section[][];
  /** The groups the search may choose from. */
  options: SuggestOption[];
}

/** Every distinct section group of a course whose members are all open. */
function openChoices(course: Course): SuggestChoice[] {
  const seen = new Set<string>();
  const choices: SuggestChoice[] = [];
  for (const section of course.sections) {
    const group = expandSectionGroup(course, section);
    const key = group
      .map((member) => member.teachTableId)
      .sort()
      .join(',');
    if (!seen.has(key) && group.every(isSelectable)) {
      seen.add(key);
      choices.push({ course, section, group, current: false });
    }
  }
  return choices;
}

/** The options of a ticked plan subject: its own group first, then the moves. */
function plannedChoices({ course, current }: PlannedSubject): SuggestChoice[] {
  const [section] = current;
  if (section === undefined) {
    return [];
  }
  const own: SuggestChoice = { course, section, group: current, current: true };
  const ownIds = new Set(current.map((member) => member.teachTableId));
  const moves = openChoices(course).filter(
    (choice) =>
      !choice.group.some((member) => ownIds.has(member.teachTableId)) &&
      !interchangeable(choice.group, current),
  );
  return [own, ...collapseInterchangeable(moves)];
}

/**
 * The ticked candidates, with options numbered from zero: the ticked plan subjects
 * first, in plan order, then the ticked courses of the result not in the plan.
 */
export function suggestCandidates(
  courses: readonly Course[],
  subjects: ReadonlySet<string>,
  planned: readonly PlannedSubject[],
): SuggestCandidate[] {
  const inPlan = new Set(planned.map(({ course }) => course.subjectId));
  let index = 0;
  const numbered = (choices: SuggestChoice[]): SuggestOption[] =>
    choices.map((choice) => {
      const option = { index, choice };
      index += 1;
      return option;
    });
  const required = planned
    .filter(({ course }) => subjects.has(course.subjectId))
    .map((subject) => ({
      course: subject.course,
      required: true,
      open: [],
      options: numbered(plannedChoices(subject)),
    }));
  const optional = courses
    .filter(
      (course) =>
        subjects.has(course.subjectId) && !inPlan.has(course.subjectId),
    )
    .map((course) => {
      const open = openChoices(course);
      return {
        course,
        required: false,
        open: open.map((choice) => choice.group),
        options: numbered(collapseInterchangeable(open)),
      };
    });
  return [...required, ...optional];
}
