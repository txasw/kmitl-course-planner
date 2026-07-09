# 24. Course level drag keyboard parity

Status: Accepted
Date: 2026-07-09

## Context

The catalog course card is a second drag source next to the per section grip. A
course drag paints every section of the course as a candidate slot on the grid at
once, so a pointer user can compare the open slots and drop onto one. A section
grip supports both pointer drag and a keyboard commit through Enter or Space, so
the question is whether the course drag needs its own keyboard path too. A keyboard
course pick would have to let the user step through the candidate slots and choose
one, which is a small selection widget layered over the grid, with its own focus
order, roving tabindex, and announcements.

## Decision

The course drag is pointer only. Its grip carries the drag listeners but no
keyboard handler and is not in the tab order; it is marked aria-hidden because it
duplicates an action the keyboard already has. Keyboard parity is met by the per
section add buttons, which are focusable, commit or route to the blocked feedback,
and reach exactly the same set of sections the course drag enumerates as
candidates. A keyboard user therefore never needs the course grip: they tab to the
section they want and press it, which is the same outcome as dropping the course on
that section's candidate slot.

## Alternatives considered

Building a keyboard candidate picker over the grid was rejected because it adds a
focus trap, a roving selection, and a second announcement vocabulary to reach an
outcome the per section add buttons already deliver, which is more surface to test
and maintain for no new capability. Leaving the course grip focusable with no
keyboard handler was rejected because a focusable control that does nothing on
Enter or Space is a dead control that misleads keyboard and screen reader users.

## Consequences

The course drag stays a pointer convenience for scanning open slots, and no path to
adding a section is keyboard only. There is one keyboard vocabulary for adding, the
section buttons, so nothing new to learn or announce. If a keyboard first way to
survey a course's open slots is wanted later, it can be added as a separate view
without disturbing this drag, since the drag makes no keyboard promise to keep.

## Amendment: the block move and swap gestures (2026-07-09)

Two more pointer gestures join the planner: a placed block can be dragged off its
slot to move it to another section of its subject or onto the remove zone, and a
blocked drag can be dropped on a blocking block to swap. The parity argument here does
not transfer unchanged from the course drag, because these gestures start on the grid,
not in the catalog where the add buttons live, and the catalog only lists a subject
while a search that includes it is on screen.

The decision holds: move and swap stay pointer only conveniences and their grips carry
no keyboard handler. Removal keeps a keyboard path that does not depend on the catalog,
because each placed block now carries its own focusable remove control, so a block can
always be removed from the grid by keyboard. Re-placing a removed section, and reaching
a move or swap outcome, go through the per section add buttons in the catalog, bridged
by the reveal in catalog action when the subject is not currently listed. A keyboard
user therefore never needs a grip: they remove from the block and add from the section
row, which reach the same outcomes the pointer gestures do.

Building a keyboard move or swap picker over the grid was rejected for the same reason
the course picker was: it adds a focus trap, a roving selection, and a second
announcement vocabulary to reach an outcome the remove control and the add buttons
already deliver. The one honest gap, that re-placing depends on the subject being
listed, is closed by the reveal action rather than by a new grid widget.
