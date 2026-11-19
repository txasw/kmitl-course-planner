// The time footprint of a suggested timetable, and the rules that keep the three
// suggestions different in what a student would actually live through. A subject
// often runs several sections at the same hours, and a suggestion that only swaps
// one of them for another reads as the same week. Two timetables whose chosen
// subjects meet on the same days at the same minutes are therefore one option,
// whatever their section codes, rooms, or teachers.
//
// The collapse runs at two levels. Inside one course, section groups that meet at
// the same times and sit the same exam windows are interchangeable for every rule
// checkPlacement applies, so only the first, the lowest section code, stays an
// option; this also keeps the search from walking copies. Groups that meet at the
// same times but sit different exams are not interchangeable, since one may clash
// where the other does not, so both stay options, and the timetables they produce
// collapse instead: of two kept timetables with one footprint, the one that ranks
// first stays, which on a tie is the lower section codes subject by subject.

import type { Meeting, Section } from '../domain/types';
import type { SuggestChoice } from './suggestCandidates';
import { compareRanked, type RankedTimetable } from './suggestRank';

function meetingKey(meeting: Meeting): string {
  return `${String(meeting.day)}@${String(meeting.startMin)}-${String(meeting.endMin)}`;
}

// A search reads the footprint of the same few groups at many leaves, and a group
// array is never changed once built, so each is worked out once.
const groupFootprints = new WeakMap<readonly Section[], string>();

/** The meeting times of a section group, a section with its declared pair. */
export function groupFootprint(group: readonly Section[]): string {
  let footprint = groupFootprints.get(group);
  if (footprint === undefined) {
    footprint = group
      .flatMap((member) => member.meetings.map(meetingKey))
      .sort()
      .join(',');
    groupFootprints.set(group, footprint);
  }
  return footprint;
}

function examKey(group: readonly Section[]): string {
  return group
    .map(({ exam }) =>
      [exam.midterm, exam.final]
        .map((range) =>
          range === undefined ? '' : `${range.start}~${range.end}`,
        )
        .join('/'),
    )
    .sort()
    .join(',');
}

/** The time footprint of a timetable: every chosen subject with its meeting times. */
export function timetableFootprint(choices: readonly SuggestChoice[]): string {
  return choices
    .map(
      (choice) => `${choice.course.subjectId}=${groupFootprint(choice.group)}`,
    )
    .sort()
    .join('|');
}

function bySectionCode(a: SuggestChoice, b: SuggestChoice): number {
  return a.section.section.localeCompare(b.section.section, undefined, {
    numeric: true,
  });
}

/**
 * The choices of one course with interchangeable groups collapsed: groups with the
 * same meeting times and the same exam windows keep only the lowest section code.
 */
export function collapseInterchangeable(
  choices: readonly SuggestChoice[],
): SuggestChoice[] {
  const kept = new Map<string, SuggestChoice>();
  for (const choice of [...choices].sort(bySectionCode)) {
    const key = `${groupFootprint(choice.group)}#${examKey(choice.group)}`;
    if (!kept.has(key)) {
      kept.set(key, choice);
    }
  }
  const first = new Set(kept.values());
  return choices.filter((choice) => first.has(choice));
}

/**
 * The best timetables kept with `next` considered, at most `limit`, best first, and
 * no two with one footprint: `next` replaces a kept timetable of its footprint only
 * when it ranks before it, and is dropped otherwise.
 */
export function keepDistinct(
  kept: readonly RankedTimetable[],
  next: RankedTimetable,
  limit: number,
): RankedTimetable[] {
  const same = kept.find((ranked) => ranked.footprint === next.footprint);
  if (same !== undefined && compareRanked(same, next) <= 0) {
    return [...kept];
  }
  return [...kept.filter((ranked) => ranked !== same), next]
    .sort(compareRanked)
    .slice(0, limit);
}
