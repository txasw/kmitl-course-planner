// The track numbering the weekly grid layers share. The grid places every child by track
// index, so the axis, the day lanes, and the candidate layer must agree on which track is
// the axis and where the day and time tracks begin. Landscape puts days on rows and time on
// columns; portrait swaps them.

export type Orientation = 'landscape' | 'portrait';

export const AXIS_INDEX = 1; // the leading axis track: landscape row 1, portrait column 1
export const FIRST_DAY_INDEX = 2; // first day track: landscape row 2, portrait column 2
export const FIRST_TIME_INDEX = 2; // first quarter track: landscape column 2, portrait row 2
export const QUARTERS_PER_HOUR = 4;
