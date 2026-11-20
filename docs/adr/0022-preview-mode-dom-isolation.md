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

## Amendment, 2026-11-20: one export entry, and every opening starts in edit

Supersedes brief section 6.4 where it says the mode is switched by a segmented control in the
panel header and where it says the last used mode persists in preferences and the default is edit,
and the sentence above that has the mode persist under the preferences key. Owner
decision of 2026-11-20 (feedback item 2, decision q4 A): students who switched to preview got stuck
there, did not recognise the edit and preview segmented control as the way back, and met the
preview again on the next opening because the mode was remembered.

Entry. The edit and preview segmented control in the header is removed. The edit header carries one
Export button, a share icon with the label ส่งออก or Export, in the neutral soft depth style rather
than a filled segment, so it reads as an action and not as a mode indicator. Below 360 px the label
becomes sr-only text and stays the accessible name. The button opens the export page, which is the
preview composition of this record unchanged: the template gallery, the display options, share
image, copy image, download image, and copy as text, with every mutating control out of the DOM.

Exit. On the export page the header leads with a Back to editing button, กลับไปแก้ไข, an arrow
and a label that always shows in full, in place of the brand mark and the plan switcher; the
poster already names the plan, and a plan is switched while editing. The overflow menu and the
close control stay. Escape that no inner surface claims returns to editing first and closes the
panel only from editing, routed through the overlay focus trap of ADR-0056. The system back
gesture does the same: while the panel is open on the export page, the back button holds one
history layer above the overlay's, with the same marker, URL, and activation rule as ADR-0067, so a
first back returns to editing and a second closes the panel. Leaving the export page by its button
or by Escape unwinds that entry. The layer follows the panel's open flag, so a panel closed from
the export page unwinds the export entry before the overlay's. When the page changes and the pressed
button unmounts, focus moves to the button of the page just entered, unless another control, such
as a dialog the change opened, took it. Entering the export page is also spoken through the status
store of ADR-0048, since focus landing on the way back does not say that a page opened, as the
pressed state of the removed toggle did; returning to editing says nothing beyond the focus move.

Persistence. The mode is session state only. Every opening of a closed panel starts in edit, from
the launcher, the toolbar action, or any entry prompt; an open call while the panel is already open
keeps the page the student is on. The preferences no longer write a viewMode field. A blob written
by an earlier build still carries it, and the preferences schema strips it like any unknown key,
so the blob loads whole with its language and other choices and is never discarded or quarantined;
a unit test reads such a blob through the real repository.

Alternatives considered. Keeping the segmented control and adding a back button on the preview was
rejected because two ways into one page and a remembered mode keep the confusion the owner reported.
Keeping the remembered mode while adding the back button was rejected because a student who closed
the panel on the export page would still reopen onto it and have to find the way back first.
Leaving Escape to close the whole panel from the export page was rejected because the export page
reads as a page above editing, and every other layer of the panel closes one level per press.
