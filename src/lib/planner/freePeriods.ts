// Free weekdays and long gaps over a plan's placed meetings. Students often plan around a
// day off or a long break between classes, and the footer only lists days that carry load,
// so neither is visible on its own. A free weekday is Monday through Friday with no
// meeting; the weekend is not counted, since a free Saturday is the usual case and saying
// so adds nothing. A long gap is the time between two classes on one day, after
// overlapping and touching meetings merge, when it lasts at least three hours. The time
// before the first class and after the last is not a gap, because a day has no natural
// start or end to measure from. The module takes plain day and minute bounds rather than
// plan entries, so it stays independent of how a plan stores its sections.

import { WEEK_DAYS, type DayOfWeek } from '../parsing/days';
import type { Meeting } from '../domain/types';

/** The shortest break between classes, in minutes, that counts as a long gap. */
export const LONG_GAP_MIN = 180;

/** The days that can read as free: Monday (1) through Friday (5). */
export const WORKING_DAYS: readonly DayOfWeek[] = [1, 2, 3, 4, 5];

export type MeetingSpan = Pick<Meeting, 'day' | 'startMin' | 'endMin'>;

/** A break of at least `LONG_GAP_MIN` between two classes on one day. */
export interface FreeGap {
  day: DayOfWeek;
  startMin: number;
  endMin: number;
}

export interface FreePeriods {
  /** Working days with no meeting, Monday first. */
  freeDays: DayOfWeek[];
  /** Long gaps ordered Sunday through Saturday, then by start. */
  gaps: FreeGap[];
}

/** The day's meetings merged into disjoint busy spans, ordered by start. */
function busySpans(spans: readonly MeetingSpan[]): MeetingSpan[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  const merged: MeetingSpan[] = [];
  for (const span of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && span.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, span.endMin);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/** The free weekdays and the long gaps between classes across the given meetings. */
export function computeFreePeriods(
  meetings: readonly MeetingSpan[],
): FreePeriods {
  const gaps: FreeGap[] = [];
  const busyDays = new Set<DayOfWeek>();
  for (const day of WEEK_DAYS) {
    const spans = busySpans(meetings.filter((meeting) => meeting.day === day));
    if (spans.length > 0) {
      busyDays.add(day);
    }
    let previous: MeetingSpan | undefined;
    for (const current of spans) {
      if (
        previous !== undefined &&
        current.startMin - previous.endMin >= LONG_GAP_MIN
      ) {
        gaps.push({ day, startMin: previous.endMin, endMin: current.startMin });
      }
      previous = current;
    }
  }
  const freeDays = WORKING_DAYS.filter((day) => !busyDays.has(day));
  return { freeDays, gaps };
}
