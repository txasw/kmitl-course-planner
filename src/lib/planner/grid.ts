// Grid geometry for the weekly timetable. Days render as rows and 15 minute
// quarters as columns, and every block position derives from minutes since
// midnight, never from pixels. This module is the single source of the window
// bounds, the quarter model, and the minute to column conversion, so the React
// grid and its tests share one geometry.

import { WEEK_DAYS, type DayOfWeek } from '../parsing/days';
import type { Meeting } from '../domain/types';

/** Minutes covered by one grid column. */
export const QUARTER_MIN = 15;

/** Default visible window start, 07:00 as minutes since midnight. */
export const DEFAULT_WINDOW_START_MIN = 7 * 60;

/** Default visible window end, 21:00 as minutes since midnight. */
export const DEFAULT_WINDOW_END_MIN = 21 * 60;

/** Days shown on the grid, Sunday through Saturday. */
export const GRID_DAY_COUNT = 7;

const MINUTES_PER_HOUR = 60;

/** The visible time window. Both bounds sit on an hour boundary. */
export interface GridWindow {
  startMin: number;
  endMin: number;
}

/** The default 07:00 to 21:00 window before any auto extension. */
export const DEFAULT_WINDOW: GridWindow = {
  startMin: DEFAULT_WINDOW_START_MIN,
  endMin: DEFAULT_WINDOW_END_MIN,
};

/** The template poster base window, 08:00 to 18:00, before any auto extension. */
export const SMART_WINDOW_START_MIN = 8 * 60;
export const SMART_WINDOW_END_MIN = 18 * 60;

/** The smart window base, 08:00 to 18:00 (the common teaching day). */
export const SMART_WINDOW: GridWindow = {
  startMin: SMART_WINDOW_START_MIN,
  endMin: SMART_WINDOW_END_MIN,
};

function floorToHour(min: number): number {
  return Math.floor(min / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

function ceilToHour(min: number): number {
  return Math.ceil(min / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

/**
 * The window that shows every given meeting, extending the base window down or up
 * to the nearest hour when a meeting starts before or ends after it. The base
 * bounds are the floor, so the window never shrinks below the default. Meetings
 * are the union of placed and highlighted sections, so a hovered catalog section
 * that reaches outside the current window widens it before the drag begins.
 */
export function computeWindow(
  meetings: Meeting[],
  base: GridWindow = DEFAULT_WINDOW,
): GridWindow {
  let startMin = base.startMin;
  let endMin = base.endMin;
  for (const meeting of meetings) {
    if (meeting.startMin < startMin) {
      startMin = floorToHour(meeting.startMin);
    }
    if (meeting.endMin > endMin) {
      endMin = ceilToHour(meeting.endMin);
    }
  }
  return { startMin, endMin };
}

/**
 * The tightest hour aligned window that shows every given meeting, for the fit to
 * content preview option. Unlike computeWindow it ignores the default bounds and
 * trims to the meetings themselves, so a plan that runs 09:00 to 15:00 shows only
 * those hours. With no scheduled meetings it falls back to the default window, so
 * an all unscheduled plan still renders a sensible empty grid beside its shelf.
 */
export function computeFitWindow(meetings: Meeting[]): GridWindow {
  if (meetings.length === 0) {
    return DEFAULT_WINDOW;
  }
  let startMin = Infinity;
  let endMin = -Infinity;
  for (const meeting of meetings) {
    if (meeting.startMin < startMin) {
      startMin = meeting.startMin;
    }
    if (meeting.endMin > endMin) {
      endMin = meeting.endMin;
    }
  }
  return { startMin: floorToHour(startMin), endMin: ceilToHour(endMin) };
}

/**
 * The contiguous run of day rows from the first to the last day that carries a
 * meeting, for the fit to content preview option. Interior days with no meeting
 * stay in the run so the week reads continuously, while empty leading and trailing
 * days are trimmed. With no meetings it returns the full week, so an all
 * unscheduled plan keeps a complete grid rather than collapsing to nothing.
 */
export function visibleDays(meetings: Meeting[]): DayOfWeek[] {
  if (meetings.length === 0) {
    return [...WEEK_DAYS];
  }
  let first: DayOfWeek = 6;
  let last: DayOfWeek = 0;
  for (const meeting of meetings) {
    if (meeting.day < first) {
      first = meeting.day;
    }
    if (meeting.day > last) {
      last = meeting.day;
    }
  }
  const days: DayOfWeek[] = [];
  for (let day = first; day <= last; day += 1) {
    days.push(day);
  }
  return days;
}

/**
 * The template poster window: the 08:00 to 18:00 teaching day, extended to the hour
 * boundary that clears any meeting falling outside it (down to the floor hour of an early
 * start, up to the ceil hour of a late end). This supersedes the fit to content window for
 * templates: a poster reads as a familiar working day, not a band trimmed to whatever hours
 * the plan happens to use. With no meetings it returns the base window (ADR, precedence is
 * template canvas, then this window, then display options).
 */
export function computeSmartWindow(meetings: Meeting[]): GridWindow {
  let startMin = SMART_WINDOW_START_MIN;
  let endMin = SMART_WINDOW_END_MIN;
  for (const meeting of meetings) {
    if (meeting.startMin < startMin) {
      startMin = floorToHour(meeting.startMin);
    }
    if (meeting.endMin > endMin) {
      endMin = ceilToHour(meeting.endMin);
    }
  }
  return { startMin, endMin };
}

/**
 * The day rows a template poster shows: Monday through Friday as the base working week,
 * revealing Sunday when a Sunday meeting exists and revealing both Saturday and Sunday
 * (the weekend pair) when a Saturday meeting exists. The Monday to Friday base always shows
 * so a poster keeps a full working week frame even when a plan is sparse. The run is
 * contiguous from its first to its last day.
 */
export function smartVisibleDays(meetings: Meeting[]): DayOfWeek[] {
  let hasSaturday = false;
  let hasSunday = false;
  for (const meeting of meetings) {
    if (meeting.day === 6) {
      hasSaturday = true;
    }
    if (meeting.day === 0) {
      hasSunday = true;
    }
  }
  // A Saturday meeting reveals Sunday too, so any weekend meeting opens the run at Sunday.
  const start: DayOfWeek = hasSaturday || hasSunday ? 0 : 1;
  const end: DayOfWeek = hasSaturday ? 6 : 5;
  const days: DayOfWeek[] = [];
  for (let day = start; day <= end; day += 1) {
    days.push(day);
  }
  return days;
}

/** The number of quarter columns the window spans. */
export function quarterCount(window: GridWindow): number {
  return (window.endMin - window.startMin) / QUARTER_MIN;
}

/** A meeting's column span, as zero based quarter indices from the window start. */
export interface ColumnSpan {
  /** First quarter the block occupies, inclusive, zero based from the window. */
  startQuarter: number;
  /** Quarter after the last the block occupies, exclusive. */
  endQuarter: number;
  /** Number of quarter columns the block spans. */
  span: number;
}

/**
 * Map a minute range to whole quarter columns. The start floors and the end
 * ceils so a meeting that does not land on a quarter boundary still fills whole
 * columns that fully contain it. Callers pass a window from `computeWindow`, so
 * the range sits inside the window and the indices stay in range. The 09:00 to
 * 12:00 meeting in the default window spans quarters 8 through 20.
 */
export function meetingColumns(
  startMin: number,
  endMin: number,
  window: GridWindow,
): ColumnSpan {
  const startQuarter = Math.floor((startMin - window.startMin) / QUARTER_MIN);
  const endQuarter = Math.ceil((endMin - window.startMin) / QUARTER_MIN);
  return { startQuarter, endQuarter, span: endQuarter - startQuarter };
}

/**
 * The minute of each hour boundary from the window start through its end, for the
 * top axis labels. Both bounds are hour aligned, so the ticks are whole hours.
 */
export function hourTicks(window: GridWindow): number[] {
  const ticks: number[] = [];
  for (
    let min = window.startMin;
    min <= window.endMin;
    min += MINUTES_PER_HOUR
  ) {
    ticks.push(min);
  }
  return ticks;
}

/** Scheduled minutes per day, keyed by `DayOfWeek`, for the footer load summary. */
export type PerDayLoad = Record<DayOfWeek, number>;

/**
 * Total scheduled minutes on each day across the given meetings. Unscheduled
 * sections carry no meetings, so they contribute nothing and never appear here.
 */
export function perDayLoad(meetings: Meeting[]): PerDayLoad {
  const load: PerDayLoad = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const meeting of meetings) {
    load[meeting.day] += meeting.endMin - meeting.startMin;
  }
  return load;
}
