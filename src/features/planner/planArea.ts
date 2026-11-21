// The plan area: the timetable and the unscheduled shelf, between the view tabs and the
// status row, marked by the data-plan-area attribute. The block detail popover stands as a
// column of it below the timetable's head, the pinned row of hour labels, or of day labels
// in portrait, marked by the data-plan-area-head attribute. The column's edges then meet the
// head's foot and the area's, so they cut no line inside the area, in its head, or in the
// status row and tab row around it.

/** The selector that finds the plan area from a node inside it. */
export const PLAN_AREA_SELECTOR = '[data-plan-area]';

/** The selector of the timetable head inside the plan area, whose foot a column starts at. */
export const PLAN_AREA_HEAD_SELECTOR = '[data-plan-area-head]';
