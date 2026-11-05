# 50. Edit grid smart window and sticky axes

Status: Accepted
Date: 2026-11-05

Amends brief section 6.4 (the 07:00 to 21:00 default window and the seven day rows), ADR-0043
(the smart window limited to export templates) and ADR-0046 (edit mode unmeasured, with the
subject id always shown).

## Context

The edit grid uses the fixed 07:00 to 21:00 window from section 6.4, 56 quarters, with a 704 px
minimum width, and extends it for any placed, dragged, hovered or candidate meeting outside it.
With the search rail in place the grid region is about 544 px at 1280 px, so the axis ends at
17:00; it ends at 19:00 at 1366 px and 20:00 at 1024 px, with blocks clipped. Nothing in the grid
is sticky, so the day labels scroll out of view with the content and there is no cue that more
time exists to the side. The hour labels are absolutely positioned, which is why they cannot
stick, and the hour and quarter lines are a gradient per day row that misaligns between rows
under the poster scale.

ADR-0043 introduced the smart window, the 08:00 to 18:00 working day extended to the hour that
clears any outlier, and Monday to Friday revealing the weekend for a weekend meeting, but scoped
it to export templates and left edit mode on the extending default. ADR-0046 kept edit mode
unmeasured, so an edit block clips its foot line through the glyphs on a short meeting. Once
ADR-0048 removes the rail, the grid gets the full width of its column and a smaller window can fit
it.

## Decision

Smart window in edit. The edit grid derives its window from `computeSmartWindow` and its days from
`smartVisibleDays` over the placed meetings plus every meeting in the current catalog result. The
catalog result is the normalized result of the last search, independent of the client side
filters, so filtering never reflows the grid. Hover never changes the layout. Every candidate a
section drag, a course drag or a block move can paint comes from the current catalog result, so
the window already covers it, and the window is frozen at drag start so candidate slots never
shift during a drag. With no catalog result, the window covers the placed meetings alone and
starts from the 08:00 to 18:00 working day.

Hidden empty weekends. Saturday and Sunday rows hide in edit unless a placed or catalog meeting
needs them, using the same reveal rule as ADR-0043: a Sunday meeting reveals Sunday, and a
Saturday meeting reveals both weekend days.

Derived minimum width. The landscape grid minimum is 40 px for the day labels plus 14 px per
quarter in the window, so the 08:00 to 18:00 window needs 600 px. This replaces the fixed 44rem
minimum, and the minimum now grows and shrinks with the window rather than assuming 07:00 to
21:00.

Scroll, not fit, as the fallback. When a broad catalog result widens the window past the column,
the grid keeps 14 px per quarter and scrolls horizontally. For example, the GenEd category search
includes evening sections that widen the window to about 08:00 to 21:00, 52 quarters or 768 px of
grid, against about 640 px in the Wide tier at 1024 to 1279 px. The quarter width is never shrunk
to fit, because a shrinking quarter makes block text unreadable and changes the block fit from one
search to the next. The sticky axes and the edge fade below are what keep a scrolled grid
readable.

Sticky axes as grid items. The day label column, the hour label row and the corner cell are sticky
inside the planner scroller, on the surface background with a 1 px border and a z index above the
lanes, swapping left and top in portrait. The hour labels become grid items placed on their hour
line rather than absolutely positioned elements, keeping the centred ruler from ADR-0043. The hour
rules become one grid item per hour spanning every day track, with the stronger rule at 12:00 and
at the window edges, shared with the poster, which replaces the per row gradient. Every axis
element stays a direct child of the one flat grid and stays aria hidden, as ADR-0028 requires.
Stickiness applies in edit only and is off in the poster, so the capture rasterizes a flat grid. A
16 px edge fade marks each side that has more content to scroll.

Measured fit in edit. The measured density from ADR-0046 runs in edit as well, keyed on the window
and the box size so it runs again on resize, and never during a drag, so the drag frame budget holds.
The edit grid walks the ladder from ADR-0047, whose first rung is the subject id. Edit still
ignores the subject id display option and shows the id whenever it fits; it is the first field to
drop on a short block, since the hover card and the block details always show it.

## Alternatives considered

Keeping the fixed 07:00 to 21:00 edit window was rejected because it causes the clipping and
spends width on early and late hours that most plans never use. A window derived from hover was
rejected because the grid would reflow while the student browses the catalog. Including the dragged meetings without a
freeze was rejected because a candidate slot that moves under the pointer cannot be dropped on
reliably. Only lowering the minimum to 36rem was rejected because it fixes no width while the rail
exists and still assumes the fixed window.

Fitting a wide window by shrinking the quarter width was rejected for the readability reason
above. Keeping the hour labels absolutely positioned and making a separate sticky overlay was
rejected because it would duplicate the axis outside the grid coordinates and drift from the
blocks under the poster scale. Keeping edit mode unmeasured was rejected because the clipped foot
line is a visible defect on the most used surface.

## Consequences

With the rail gone and the window smart, 1280 and 1366 px laptops show the whole working day with
no horizontal scroll, and the tablet tiers fit the 600 px minimum. A broad search can still widen
the grid past its column; then it scrolls with the day and hour axes in view, which is a stated
fallback rather than a defect, and the end to end check for it runs on the real GenEd category
capture rather than a synthetic working day. The shared hour rules change export pixels slightly,
because the poster draws the same rules. Edit blocks drop whole fields instead of clipping, at the
cost of a measurement pass after each window or size change. The pure geometry in `grid.ts` is
reused unchanged; only its inputs in edit differ.
