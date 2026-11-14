// The narrow timetable of ADR-0049, which shows one day at a time unless the student picks
// the portrait week. A grid scroller under 640 px reads the plan day by day, and a row of
// day chips keeps the shape of the week in view: Monday to Friday always, Saturday and
// Sunday only when a meeting falls on them, each chip marked for a class day and for a
// time conflict. This module holds the pure rules behind that view, so the chips, the
// swipe, and their tests share one source.

import type { DayOfWeek } from '../parsing/days';
import type { Meeting } from '../domain/types';
import { BREAKPOINTS } from '../ui/breakpoints';
import { WORKING_DAYS } from './freePeriods';
import type { ConflictDetail } from './placement';

/**
 * The layouts a narrow timetable offers: one day at a time under the day chips, or the whole
 * week in portrait. The day is the default; the week is the student's choice, remembered as
 * a preference.
 */
export const TIMETABLE_VIEWS = ['day', 'week'] as const;
export type TimetableView = (typeof TIMETABLE_VIEWS)[number];
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
 * The day the view opens on: the first offered day with a class, so a plan that starts on
 * Wednesday opens on Wednesday. A plan with no scheduled class opens on the first offered
 * day, Monday.
 */
export function initialDay(
  days: readonly DayOfWeek[],
  flags: DayFlags,
): DayOfWeek {
  return days.find((day) => flags[day].hasClass) ?? days[0] ?? 1;
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
): DayOfWeek {
  return chosen !== null && days.includes(chosen)
    ? chosen
    : initialDay(days, flags);
}

/**
 * The day a step from the current one lands on, in chip order. The arrow keys of the radio
 * group wrap around the row, as a radio group does; a swipe stops at either end, so a long
 * swipe never jumps from Friday back to Monday.
 */
export function stepDay(
  days: readonly DayOfWeek[],
  current: DayOfWeek,
  step: 1 | -1,
  wrap: boolean,
): DayOfWeek {
  const index = days.indexOf(current);
  if (index === -1) {
    return days[0] ?? current;
  }
  const next = index + step;
  if (wrap) {
    return days[(next + days.length) % days.length] ?? current;
  }
  return days[Math.max(0, Math.min(days.length - 1, next))] ?? current;
}
