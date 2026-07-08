# 22. Preview mode removes mutating controls from the DOM

Status: Accepted
Date: 2026-07-08

## Context

The planner has two modes. Edit is the full three region workspace with drag,
add, and remove. Preview is a read only poster built for sharing: the rails
collapse, the timetable takes the full panel width, and a header carries the plan
name, the total credits, and the generation date. A shared plan must be exactly
what is on screen, with no way to alter it by accident and nothing inert left
lying around that a keyboard user could still reach.

## Decision

Preview removes every mutating control from the DOM rather than disabling it. The
mode lives in the ui store and persists under the preferences key. When it is
preview, the layout does not render the search rail or the catalog at all, the
grid takes the full width, and the add and remove buttons, the drag handles, and
the drop zone are simply not in the tree. Disabled controls are not used, because
a disabled control is still focusable in some flows and still reads as a control
to a screen reader, which contradicts the read only intent. Revalidation still
runs on preview open and its badges still render, because correctness matters most
at the moment of sharing.

## Alternatives considered

Disabling the controls and hiding them with CSS was rejected because a disabled or
visually hidden control can still be in the accessibility tree and the tab order,
so the surface is not truly read only and an automated check cannot prove it is.
A separate read only route or component tree duplicating the grid was rejected
because it would fork the rendering and let the preview drift from the live grid;
one grid that renders differently per mode keeps them identical. Leaving the rails
mounted but empty was rejected because it wastes the poster width the sharing
composition needs.

## Consequences

Preview is provably read only: an automated test asserts zero add or remove
controls in the DOM, which a disabled state could not guarantee. The grid renders
from the same components in both modes, so a change to a block or the shelf shows
in the poster automatically. The one visible side effect of entering preview is
the collapsed rails and the poster header; everything else is the same grid.
