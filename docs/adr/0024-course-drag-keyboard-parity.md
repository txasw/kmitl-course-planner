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
