// The courses a plan suggestion may choose from, and the section groups each can
// take. A candidate is a curriculum course of the current result whose subject is
// not already in the plan. Its options are the distinct section groups, a section
// with its declared pair, whose members are all open and which fit the locked
// entries; a full or closed section is never an option. The open groups are kept
// as well, so a course with no option can still say why it was left out.

import { isSelectable } from '../catalog/seatStatus';
import { isCurriculumCourse } from '../catalog/subjectGroup';
import type { Course, Section } from '../domain/types';
import type { PlanEntry } from '../domain/plan';
import { checkPlacement, expandSectionGroup } from './placement';

/** One chosen course: the section to add and the group the add places with it. */
export interface SuggestChoice {
  course: Course;
  section: Section;
  group: Section[];
}

/** A choice with a dense index across every candidate, for the search's tables. */
export interface SuggestOption {
  index: number;
  choice: SuggestChoice;
}

export interface SuggestCandidate {
  course: Course;
  /** Open section groups, before the locked entries are considered. */
  open: Section[][];
  /** Open section groups that fit the locked entries. */
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
      choices.push({ course, section, group });
    }
  }
  return choices;
}

/** The curriculum candidates of a result, with options numbered from zero. */
export function suggestCandidates(
  courses: readonly Course[],
  lockedEntries: readonly PlanEntry[],
  locked: Section[],
): SuggestCandidate[] {
  const lockedSubjects = new Set(lockedEntries.map((entry) => entry.subjectId));
  let index = 0;
  return courses
    .filter(
      (course) =>
        isCurriculumCourse(course) && !lockedSubjects.has(course.subjectId),
    )
    .map((course) => {
      const open = openChoices(course);
      const options = open
        .filter((choice) => checkPlacement(locked, choice.group).ok)
        .map((choice) => ({ index: index++, choice }));
      return { course, open: open.map((choice) => choice.group), options };
    });
}
