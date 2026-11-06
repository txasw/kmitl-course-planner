// The one line summary of a collapsed course card: how many sections the course has,
// which days they meet, and whether any of them fits the plan. The fit is read from the
// same candidate engine as the course drag, so the summary, the drag and the rows an
// open card shows never disagree, including exam clashes, declared pairs and seats.

import type { Course, DayOfWeek, Section } from '../domain/types';
import { createTranslator, type Locale } from '../i18n/t';
import { dayFullLabelKey } from '../i18n/dayLabel';
import { courseCandidates } from '../planner/courseCandidates';

export type CourseFit =
  /** The course is from another term than the plan, so it is not classified. */
  | { kind: 'crossTerm' }
  /** At least one section can be added; count is how many. */
  | { kind: 'addable'; count: number }
  /** Every section clashes with the plan, in time or in an exam. */
  | { kind: 'allConflict' }
  /** Every section is full or closed. */
  | { kind: 'allUnavailable' }
  /** Nothing can be added, for a mix of reasons. */
  | { kind: 'noneAddable' };

export interface CourseSummary {
  sectionCount: number;
  /** The days any section meets, sorted from Sunday. */
  days: DayOfWeek[];
  /** The full day names as one locale list, or empty when no section meets. */
  dayList: string;
  /** Whether any section has a scheduled meeting. */
  scheduled: boolean;
  fit: CourseFit;
}

// A list formatter is costly to build and the catalog summarizes every card, so one is
// kept per locale.
const LIST_FORMATS = new Map<Locale, Intl.ListFormat>();

function listFormat(locale: Locale): Intl.ListFormat {
  let format = LIST_FORMATS.get(locale);
  if (format === undefined) {
    format = new Intl.ListFormat(locale, {
      style: 'long',
      type: 'conjunction',
    });
    LIST_FORMATS.set(locale, format);
  }
  return format;
}

function meetingDays(course: Course): DayOfWeek[] {
  const days = new Set<DayOfWeek>();
  for (const section of course.sections) {
    for (const meeting of section.meetings) days.add(meeting.day);
  }
  return [...days].sort((a, b) => a - b);
}

function classifyFit(course: Course, placed: Section[]): CourseFit {
  const candidates = courseCandidates(course, placed);
  const count = candidates.filter((candidate) => candidate.valid).length;
  if (count > 0) return { kind: 'addable', count };
  if (candidates.length === 0) return { kind: 'noneAddable' };
  if (candidates.every((candidate) => candidate.reason === 'conflict')) {
    return { kind: 'allConflict' };
  }
  if (
    candidates.every(
      (candidate) =>
        candidate.reason === 'full' || candidate.reason === 'closed',
    )
  ) {
    return { kind: 'allUnavailable' };
  }
  return { kind: 'noneAddable' };
}

/**
 * Summarizes a course as the catalog shows it, so a filtered course counts only the
 * sections the filters kept. A cross term course skips the fit, since none of its
 * sections can join the plan.
 */
export function summarizeCourse(
  course: Course,
  placed: Section[],
  crossTerm: boolean,
  locale: Locale,
): CourseSummary {
  const days = meetingDays(course);
  const t = createTranslator(locale);
  return {
    sectionCount: course.sections.length,
    days,
    dayList: listFormat(locale).format(
      days.map((day) => t(dayFullLabelKey(day))),
    ),
    scheduled: days.length > 0,
    fit: crossTerm ? { kind: 'crossTerm' } : classifyFit(course, placed),
  };
}
