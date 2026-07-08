// Alternative sections of the same subject that would place without conflict. They
// are ordered by earliest start so the soonest option comes first, with
// unscheduled sections last, and capped so the feedback strip offers at most two.
// A subject already in the plan yields no alternatives, since every other section
// of it is a duplicate, which is the signal to reveal it in the catalog instead.

import type { Course, Section } from '../domain/types';
import { checkPlacement, expandSectionGroup } from './placement';

const MAX_SUGGESTIONS = 2;
const UNSCHEDULED_SORT_KEY = Number.POSITIVE_INFINITY;

function earliestStart(section: Section): number {
  if (section.meetings.length === 0) {
    return UNSCHEDULED_SORT_KEY;
  }
  return Math.min(...section.meetings.map((meeting) => meeting.startMin));
}

export function alternativeSections(
  course: Course,
  placed: Section[],
  blocked: Section,
): Section[] {
  return course.sections
    .filter((section) => section.teachTableId !== blocked.teachTableId)
    .filter(
      (section) =>
        checkPlacement(placed, expandSectionGroup(course, section)).ok,
    )
    .sort((a, b) => earliestStart(a) - earliestStart(b))
    .slice(0, MAX_SUGGESTIONS);
}
