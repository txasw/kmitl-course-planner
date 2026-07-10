# 28. Weekly grid accessibility semantics

Status: Accepted
Date: 2026-07-10

## Context

The weekly timetable is one flat CSS grid. Days are rows and time is columns of
fifteen minute quarters, and every element, the day lane backgrounds, the event
blocks, and the drag overlays for ghosts, candidates, and swap targets, is a
direct child positioned by an explicit grid row and grid column. There is no row
or cell grouping element to hang table semantics on. Placement is fixed: a
section sits at set days and times, so a drag can only place or not place it, and
the design deliberately has no arrow key navigation because moving a block by
arrow keys would be meaningless. Phase 5 deferred the question of what ARIA role
the grid should carry; this record settles it, and the screen reader walk in the
manual QA checklist is the acceptance either way.

## Decision

The grid stays a labeled group. The container keeps `role="group"` with an
accessible name, and every event block carries a fully self contained
`aria-label`: the subject id, the name, the section, the full day, the time
range, the room when it is shown, and any verification state. The blocks are
emitted in day, then start time, then subject order, the same order the copy as
text export uses, so a screen reader and the keyboard walk traverse one coherent
chronological schedule rather than plan entry order. The visual position comes
from the grid coordinates, not the DOM order, so the sort changes only what is
read and tabbed, never the layout. The footer summary is a labeled group so the
credit and load totals are findable, and the time axis stays decorative and
aria hidden because every block already carries its own time.

## Alternatives considered

`role="grid"` was rejected as actively wrong, not merely unnecessary. It
advertises a composite widget with a single tab stop and managed arrow key
navigation between cells, which the fixed placement design does not provide, so
it would promise an interaction that does nothing and strand a screen reader
user pressing arrows. `role="table"` was also rejected: a timetable is a
continuous time axis where blocks span arbitrary quarter columns over large
empty regions, so cell by cell reading would announce meaningless empty quarters
and misrepresent a multi quarter block as a single cell. Both roles would in any
case require wrapping the blocks in row elements, which would make them
grandchildren of the grid rather than direct grid items and collapse the
coordinate positioning and the overlay layers. A separate visually hidden day
ordered schedule was rejected because the blocks are interactive, so they cannot
be aria hidden without removing the drag and remove controls from the
accessibility tree, and a parallel list would then double announce every
meeting; the sorted, self labeled blocks already deliver the same chronological
read without duplication.

## Consequences

A screen reader user hears the grid as one labeled region and then each meeting
as a complete sentence in chronological order, which is the same information the
text export produces, without a lattice of empty cells and without a promise of
navigation the design rejects. The interactive blocks stay in the accessibility
tree, so keyboard add and remove keep working. If a future need for true tabular
navigation appears, it would require the DOM restructure this record documents
as harmful and would supersede this decision rather than amend it.
