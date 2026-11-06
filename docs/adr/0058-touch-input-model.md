# 58. Touch input model

Status: Accepted
Date: 2026-11-06

Amends ADR-0006 (dnd-kit with pointer and keyboard sensors) and ADR-0024 (the course and block
drags are pointer gestures). Replaces the touch-pan-y interim on the course header recorded in
ADR-0057.

## Context

The planner registered one dnd-kit sensor, the pointer sensor with a 6 px activation distance, and
every drag surface, the section row, the course card header and the placed block, carried
touch-action none so the browser would not take the gesture for a scroll. A section row covers
most of the catalog, so on a tablet a swipe that started on a row began a drag or did nothing, and
neither the catalog nor the sideways scrolling grid could be panned. ADR-0057 moved the course
header to touch-pan-y as a stopgap.

Touch also fires compatibility mouse events, so a tap on a row drew the ghost preview of ADR-0021,
and a tap on a block opened the hover detail card of ADR-0044 next to the detail sheet the tap was
meant to open. An Android long press on a block opened the block context menu as well.

ADR-0006 still describes pointer and keyboard sensors, but the grip has committed through its own
click handler since ADR-0024, and no keyboard sensor is registered: arrow key movement means nothing
when every placement is fixed.

## Decision

The sensor set is the mouse sensor with a 6 px activation distance plus the touch sensor with a
250 ms delay and an 8 px tolerance. No keyboard sensor is registered. Keyboard input stays outside
dnd-kit: the grip commits on Enter or Space through its click handler, the add button and the
block remove control are ordinary buttons, and the course and block drags stay pointer only as
ADR-0024 records. A mouse drag behaves as before.

Touch scrolls first. The three drag surfaces carry touch-action manipulation instead of none, so
a swipe pans the catalog or the grid, and they turn off text selection and the iOS touch callout
so a held finger does not select text or open a system menu. A finger that moves more than 8 px
inside the delay is a scroll, and the touch sensor lets the browser have it. A finger held still
for 250 ms starts the drag, after which the sensor cancels the moves so the page no longer scrolls.
A tap is still a click: it toggles a course card, commits from the grip, or opens a block's detail
sheet. Controls inside a drag surface stop the mouse down and touch start events as well as the
pointer down, so pressing one never arms the drag around it.

The long press shows its progress. At 120 ms the held surface reads as pressed: a border strong
outline, over the surface alt fill on a row or a course header, since a block keeps its subject
tint. At 250 ms the drag activates: the source dims to 40 percent, the grab card is centred over
the finger with its bottom edge 32 px above it so the finger never covers it, and a 10 ms vibration
fires where the browser offers one. A mouse drag keeps the grab card anchored at the pointer.

Hover surfaces are for a mouse. The row ghost preview and the block hover card open on a pointer
enter whose pointer type is mouse, so a tap opens only the surface it targets. The course hover
preview that ADR-0057 plans follows the same rule. The block context menu does not open for a touch
pointer or while a drag is live, so a long press on a block is a drag and nothing else; the detail
sheet carries the same actions for touch.

## Alternatives considered

Keeping the pointer sensor with touch-action manipulation was rejected. Once the browser starts a
pan it fires pointercancel, so every touch drag would end the moment the finger moved. Keeping
touch-action none and adding a pan of our own was rejected because it replaces native scrolling,
its momentum and its accessibility settings with script.

A shorter delay was rejected because a slow scroll would start drags, and a longer one because the
press would feel unresponsive; 250 ms with the pressed state at 120 ms follows common platform long
press timing while leaving room for the feedback. Adding the keyboard sensor was rejected for the
reason in ADR-0024: it would arm arrow key movement that has no meaning on a fixed timetable.

Hiding hover surfaces behind a coarse pointer media query was rejected because a touch laptop has
both a mouse and a touch screen, and the pointer type of each event says which one is in use.

## Consequences

A tablet user scrolls the catalog and the grid from anywhere, including on a row, a course header
or a block, and drags with a long press. Text inside the drag surfaces can no longer be selected
with a mouse, which is the cost of a long press that does not select text; the detail popover and
the hover card still allow selection. A drag on touch starts a quarter second later than a mouse
drag, and the pressed state and the vibration make that wait visible.

The touch drag specs drive real touch events through the Chrome DevTools Protocol, so they run in
Chromium only. Firefox keeps the same sensors and its touch behaviour is checked by hand.

## Amendment, 2026-11-06: coarse pointer targets and the block remove control

Every control has a 24 px target in each direction, the WCAG 2.5.8 minimum, and grows to 44 px
under a coarse pointer through the shared target classes that read the --kcp-target-min and
--kcp-target-touch tokens. The switch follows the pointer media query, not the width, so a
touch laptop gets finger sized targets and a narrow mouse window keeps the dense layout. A
control that is a wide strip, such as the plan rows or the search submit, grows only in height;
the add rail widens from w-8 to w-11; and a small visual such as a template pager dot keeps its
size inside a full sized button.

- The remove control on a placed block is hidden under a coarse pointer. A 44 px button in the
  corner of a block would cover most of a one hour block, and a tap on the block opens the
  detail sheet, which carries the remove action. Under a fine pointer it keeps the 24 px floor.
- This amends the keyboard parity of ADR-0024, which gave each placed block its own focusable
  remove control so the grid can be edited by keyboard. A coarse pointer device can still have a
  keyboard, such as a touch laptop, so the keyboard path moves rather than disappears: the block
  is a focusable button, and Enter or Space on it opens the detail surface with the remove action
  and focus on its heading. Removal also stays reachable from the added row in the catalog.
- The rename, duplicate and delete actions on each plan row show by default and fade out only
  under a hover capable fine pointer, where hovering or focusing the row reveals them. Fading
  them everywhere except under a coarse pointer was rejected because a screen with neither hover
  nor a coarse pointer would hide them with no way to find them.

Shrinking the block remove control on touch was rejected because it would keep a target too
small for the finger it is shown to. Keeping it at 44 px and letting it cover the block was
rejected because it would hide the subject name, the one field a block never drops.
