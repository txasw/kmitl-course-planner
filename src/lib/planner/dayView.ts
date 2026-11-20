// The narrow timetable of ADR-0049, which shows one day at a time unless the student picks
// the portrait week. A grid scroller under 640 px reads the plan day by day, and a row of
// chips keeps the shape of the week in view: a week chip, then Monday to Friday always,
// Saturday and Sunday only when a meeting falls on them, each day chip marked for a class
// day and for a time conflict. This module holds the pure rules behind that view, so the chips, the
// swipe, and their tests share one source.

import { WEEK_DAYS, type DayOfWeek } from '../parsing/days';
import type { Meeting } from '../domain/types';
import { BREAKPOINTS } from '../ui/breakpoints';
import { WORKING_DAYS } from './freePeriods';
import type { ConflictDetail } from './placement';

/**
 * The layouts a narrow timetable offers: one day at a time under the day chips, or the whole
 * week in portrait. The day is the default and every opening of the panel starts on it; the
 * week is the student's choice for the rest of that opening, one tap away on the week chip.
 */
export type TimetableView = 'day' | 'week';
export const DEFAULT_TIMETABLE_VIEW: TimetableView = 'day';

/**
 * Whether a grid scroller of the given CSS pixel width is narrow, so it shows the day view
 * or, by the student's choice, the portrait week rather than the landscape week. The cut is
 * the compact tier edge, but it reads the measured scroller, so a docked catalog that
 * squeezes the grid counts too. Before the first measurement the width is zero, and the
 * layout tier stands in for it, so a phone never paints the landscape week for one frame.
 */
export function isDayViewWidth(width: number, compactTier: boolean): boolean {
  if (width === 0) {
    return compactTier;
  }
  return width < BREAKPOINTS.sm;
}

/**
 * The days the chip row offers, in its reading order: Monday to Friday, then Saturday and
 * Sunday each only when a meeting falls on it. The weekend follows the week rather than
 * opening it, so the row starts on the first teaching day.
 */
export function dayChipDays(meetings: readonly Meeting[]): DayOfWeek[] {
  const days: DayOfWeek[] = [...WORKING_DAYS];
  for (const weekend of [6, 0] as const) {
    if (meetings.some((meeting) => meeting.day === weekend)) {
      days.push(weekend);
    }
  }
  return days;
}

/** What a day chip marks about its day. */
export interface DayFlag {
  /** A placed meeting falls on the day. */
  hasClass: boolean;
  /** Two placed meetings overlap on the day. */
  hasConflict: boolean;
}

export type DayFlags = Record<DayOfWeek, DayFlag>;

/**
 * The class and conflict marks for every day. A day has a conflict when a time conflict
 * among the placed sections falls on it; an exam overlap is dated rather than weekly, so it
 * marks no day.
 */
export function dayFlags(
  meetings: readonly Meeting[],
  conflicts: ReadonlyMap<string, readonly ConflictDetail[]>,
): DayFlags {
  const clear = (): DayFlag => ({ hasClass: false, hasConflict: false });
  const flags: DayFlags = {
    0: clear(),
    1: clear(),
    2: clear(),
    3: clear(),
    4: clear(),
    5: clear(),
    6: clear(),
  };
  for (const meeting of meetings) {
    flags[meeting.day].hasClass = true;
  }
  for (const details of conflicts.values()) {
    for (const detail of details) {
      if (detail.kind === 'time') {
        flags[detail.day].hasConflict = true;
      }
    }
  }
  return flags;
}

/**
 * The day the view opens on: today when the chips offer it and it has a class, so a student
 * checking the day's classes lands on them; otherwise the first offered day with a class, so a
 * plan that starts on Wednesday opens on Wednesday. A plan with no scheduled class opens on
 * the first offered day, Monday.
 */
export function initialDay(
  days: readonly DayOfWeek[],
  flags: DayFlags,
  today: DayOfWeek,
): DayOfWeek {
  if (days.includes(today) && flags[today].hasClass) {
    return today;
  }
  return days.find((day) => flags[day].hasClass) ?? days[0] ?? 1;
}

/** The day of the week a moment falls on, in the panel's own Sunday first numbering. */
export function dayOfWeek(moment: Date): DayOfWeek {
  return WEEK_DAYS[moment.getDay()] ?? 1;
}

/**
 * The day the view shows: the chosen day while the chips still offer it, otherwise the
 * initial day. A chosen Saturday whose last class was removed drops its chip, so the view
 * falls back rather than showing a day the row no longer names.
 */
export function shownDay(
  days: readonly DayOfWeek[],
  chosen: DayOfWeek | null,
  flags: DayFlags,
  today: DayOfWeek,
): DayOfWeek {
  return chosen !== null && days.includes(chosen)
    ? chosen
    : initialDay(days, flags, today);
}

/**
 * What a chip of the narrow timetable row picks: one day for the day view, or the whole
 * week in portrait. The week chip leads the row, so the row reads as the one place the
 * narrow timetable is arranged.
 */
export type TimetableChoice = DayOfWeek | 'week';

/** The chips of the row in reading order: the week chip, then the offered days. */
export function timetableChoices(
  days: readonly DayOfWeek[],
): TimetableChoice[] {
  return ['week', ...days];
}

/**
 * The item a step from the current one lands on, in chip order. The arrow keys of the radio
 * group wrap around the row, as a radio group does; a swipe stops at either end, so a long
 * swipe never jumps from Friday back to Monday. It steps the days alone for the swipe and the
 * whole chip row, week chip included, for the arrow keys.
 */
export function stepChoice<T>(
  items: readonly T[],
  current: T,
  step: 1 | -1,
  wrap: boolean,
): T {
  const index = items.indexOf(current);
  if (index === -1) {
    return items[0] ?? current;
  }
  const next = index + step;
  if (wrap) {
    return items[(next + items.length) % items.length] ?? current;
  }
  return items[Math.max(0, Math.min(items.length - 1, next))] ?? current;
}

/**
 * The scroll offset that opens a day on its first class. The grid runs from the window start
 * under a sticky day header, so a class after noon can open below the fold of a phone. The
 * offset lifts the earliest block to just under the header, leaving a margin above it so its
 * hour label, centred on the gridline, stays readable. A day whose first class starts at the
 * window start, or a free day, opens at the top. Block tops are measured from the top of the
 * scrolled content, in CSS pixels.
 */
export function revealScrollTop(
  blockTops: readonly number[],
  headerPx: number,
  marginPx: number,
): number {
  if (blockTops.length === 0) {
    return 0;
  }
  return Math.max(0, Math.round(Math.min(...blockTops) - headerPx - marginPx));
}
