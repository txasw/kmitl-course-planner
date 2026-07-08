// Grid geometry for the weekly timetable. Days render as rows and 15 minute
// quarters as columns, and every block position derives from minutes since
// midnight, never from pixels. This module is the single source of the window
// bounds, the quarter model, and the minute to column conversion, so the React
// grid and its tests share one geometry.

import type { DayOfWeek } from '../parsing/days';
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
