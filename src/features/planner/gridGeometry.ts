// The track numbering the weekly grid layers share. The grid places every child by track
// index, so the axis, the day lanes, and the candidate layer must agree on which track is
// the axis and where the day and time tracks begin. Landscape puts days on rows and time on
// columns; portrait swaps them.

import type { CSSProperties } from 'react';
import type { Meeting } from '@/lib/domain/types';
import type { DayOfWeek } from '@/lib/parsing/days';
import { meetingColumns, type GridWindow } from '@/lib/planner/grid';
import { BASE_GRID_FONT_PX } from '@/lib/ui/breakpoints';

export type Orientation = 'landscape' | 'portrait';

export const AXIS_INDEX = 1; // the leading axis track: landscape row 1, portrait column 1
export const FIRST_DAY_INDEX = 2; // first day track: landscape row 2, portrait column 2
export const FIRST_TIME_INDEX = 2; // first quarter track: landscape column 2, portrait row 2
export const QUARTERS_PER_HOUR = 4;

/** The size of the leading axis track, in em of the grid font. */
export const AXIS_TRACK_EM = 1.4;

/** The width of the portrait hour column, the leading track down the grid's edge. */
export const PORTRAIT_AXIS_TRACK = '2.75rem';

/** The grid root font size in edit mode before the scroller is measured, in CSS pixels;
 * a wider scroller steps it up and a template sets its own. */
export const EDIT_FONT_PX = BASE_GRID_FONT_PX;

// The day track derives from the day's position in the rendered run, not the day number,
// so a preview that trims leading days still places each block correctly. With the full
// week the position equals the day, so edit mode geometry is unchanged. In portrait the
// day is the column and the time span is the rows; in landscape it is the reverse.
export function blockStyle(
  meeting: Meeting,
  window: GridWindow,
  days: readonly DayOfWeek[],
  orientation: Orientation,
): CSSProperties {
  const columns = meetingColumns(meeting.startMin, meeting.endMin, window);
  const dayTrack = FIRST_DAY_INDEX + days.indexOf(meeting.day);
  const timeStart = FIRST_TIME_INDEX + columns.startQuarter;
  const timeEnd = FIRST_TIME_INDEX + columns.endQuarter;
  if (orientation === 'portrait') {
    return {
      gridColumn: dayTrack,
      gridRow: `${String(timeStart)} / ${String(timeEnd)}`,
    };
  }
  return {
    gridRow: dayTrack,
    gridColumn: `${String(timeStart)} / ${String(timeEnd)}`,
  };
}

/**
 * Whether a meeting falls on a day the grid renders. The week grids render the day of every
 * meeting they hold, but the day view of ADR-0049 renders one, so each layer drops the
 * meetings of the other days rather than placing them on the axis track.
 */
export function onShownDay(
  meeting: Pick<Meeting, 'day'>,
  days: readonly DayOfWeek[],
): boolean {
  return days.includes(meeting.day);
}

const MAX_STACK_OFFSET = 4;
const STACK_STEP_PX = 5;
// The portrait week packs up to seven day columns into a phone width, about 45 px each, so
// the full step across a column would leave a fourth footprint too narrow for its label.
const PORTRAIT_CROSS_STEP_PX = 2;

// Footprints that share a cell fan out by their stack index so each one stays legible,
// capped so a crowded cell never pushes a footprint out of its track. Landscape fans by the
// full step on both sides. Portrait keeps the full step down the time axis, which has the
// room, and takes the narrow step across the day column.
export function stackOffsetStyle(
  stack: number,
  orientation: Orientation,
): CSSProperties {
  const level = Math.min(stack, MAX_STACK_OFFSET);
  const leftStep =
    orientation === 'portrait' ? PORTRAIT_CROSS_STEP_PX : STACK_STEP_PX;
  return {
    marginLeft: `${String(level * leftStep)}px`,
    marginTop: `${String(level * STACK_STEP_PX)}px`,
  };
}
