# 27. Export composition and honesty

Status: Accepted
Date: 2026-07-10

## Context

The preview sharing surface exports the plan three ways: a PNG poster, the same
image to the clipboard, and a plain text schedule. Two realities that emerged
after the original sharing design was written change what an export must contain.
First, a plan can hold unscheduled sections, online or asynchronous courses with
no meeting, whose credits count toward the total; the earlier design captured only
the grid. Second, revalidation classifies each entry against live data, so a
shared plan can carry a section that upstream changed or no longer lists. An export
that dropped the unscheduled sections would understate the credits a student is
sharing, and one that hid the verification state would present stale or missing
sections as if they were confirmed.

Separately, the original design placed plan JSON export and import in the preview
sharing toolbar alongside the image and text actions. Import creates a plan and
export writes the durable plan record; neither shares the on screen composition,
and import does not belong to a read only preview.

## Decision

Every export includes the unscheduled shelf and is honest about verification.
The PNG capture node is the poster composition, the header, the grid, the shelf,
and the footer, so the shelf and its credits are always in the image, and the
block revalidation badges render in the capture as they do on screen. The plain
text schedule lists the unscheduled sections under a label after the meeting lines
and marks a missing entry with a short parenthetical, so the text carries the same
credits and the same honesty as the poster.

Plan JSON export and import move to the plan menu as a data management row, and the
preview toolbar carries only the visual and text sharing actions. Export writes the
active plan validated through the plan schema; import validates a file through the
same schema at the trust boundary, lists the exact failing fields on any issue
without committing, and on success lands a new unverified plan under a fresh id
that revalidation reconciles on first open, never overwriting an existing plan.

## Alternatives considered

Capturing only the grid and appending an unscheduled list as separate export text
was rejected because a single capture node keeps the image and its credits
consistent by construction. Silently converting or dropping a changed or missing
entry on export was rejected because the sharing moment is exactly when
correctness matters most. Keeping JSON in the preview toolbar was rejected because
mixing a plan creating import into a read only preview surface confuses the
separation the preview mode establishes.

## Consequences

What the user sees in preview is what every export produces, including the shelf
and the verification badges, so there is one composition to reason about. The plan
menu owns durable plan data and the preview toolbar owns visual sharing, so each
surface has a single responsibility. A future export format reads the same poster
node and the same display options, and a future data operation joins the plan menu
rather than the toolbar.

## Amendment, 2026-11-21: the display options open inline from 640 px up

The stricter text fit sweep read the export page behind the display options and found the
popover cutting lines at its edges at 768 and 1366 px: anchored to the end of the toolbar, it
floated over the full width template chips and the poster, so its edges split a chip name such
as ภาพพื้นหลังโทรศัพท์แนวตั้ง and its size 1080 × 2340, the poster date, the hour labels, and
the toolbar status. No position of a floating layer avoids them, since the chips and the poster
fill the width under the toolbar. The rule that no text is cut or hidden at any width, in Thai
and in English, outranks the word popover in the brief for this control.

- From 640 px up the display options are a disclosure. The same toolbar button toggles an inline
  panel under the toolbar row, carrying aria-expanded and aria-controls, and the panel pushes the
  template chips and the stage down rather than float over them. The panel stays in the DOM while
  hidden, so the reference always resolves. It holds every option of the popover, the name
  language and the four switches, side by side where the width allows and wrapped where it does
  not, and the choices persist through the ui store as before. Escape from the button or the
  panel closes it only and returns focus to the button, through the shared escape layer, so the
  overlay stays open. A press elsewhere leaves it open, since closing it would move the chips and
  the poster under the pointer.
- Below 640 px the options stay a modal bottom sheet. Its scrim covers the page whole, so it cuts
  no line at an edge the student can read past.
- From 640 px up the stage keeps a floor of 16rem, so the poster stays readable with the panel
  open on a short window, and the export page scrolls past that floor rather than shrink the
  poster or clip the panel. The panel region grows past the panel height for this; edit mode
  keeps its fixed height. Below 640 px the stage keeps no floor, since the sheet covers the page
  rather than take height from it, and a floor there would push the foot toolbar out of view on
  a 320 by 640 window.
- The sweep reads the export page with the panel open as a page, with no layer to excuse, and
  reads the sheet below 640 px behind it as before.

An anchored popover capped to the space beside the toolbar was rejected, because the chips start
directly under the toolbar and any height it takes covers them. Opening the options in a modal
dialog at every width was rejected, because the student then sets an option without seeing the
poster change behind a scrim, and the inline panel keeps the poster in view as each switch
applies.

## Amendment, 2026-11-22: an export or copy shows a busy state until its toast

The owner reviewed the 1.6.0 release candidate on a phone and found the export actions silent:
a press on Download PNG or Copy image showed nothing until the toast, and a copy did the same.
The toolbar already named a running capture, but the capture started its clone inside the frame
callback that follows the font wait, and the clone runs as one long stretch of microtasks, so
the frame that would paint the busy state waited for the clone. Measured at a sixfold CPU slow
down on the A4 template, the busy label reached the screen about 1.1 s after the press, near the
end of a 1.3 s capture.

- The capture now starts in a task after that frame, so the busy state paints within a frame of
  the press and the spinner keeps turning on the compositor while the clone holds the main
  thread. The added wait is one task, well inside the share sheet's activation window, and the
  held file fallback for a share that outlasts it stays as it was.
- Every action whose outcome is a toast and that waits on work shows the same busy state: the
  image actions of the toolbar (download, copy image, share) read creating the image, copy as
  text and the registration list copy in the selected courses view read copying. The pressed
  control swaps its glyph for a spinner, which stands still under reduced motion, carries
  aria-busy, and stays aria-disabled rather than disabled, so it keeps focus. While one runs,
  every toolbar action is marked disabled and ignores presses, so no second capture or copy
  starts beside it; the running action keeps its full color while the others dim.
- The idle and busy labels share one grid cell, the inactive one hidden from view and from the
  accessible name, so a control is always as wide and as tall as the longer label and the
  toolbar never shifts when the label changes. On a phone the action row cells already wrap a
  label over two lines, and the busy label fits the same two lines, so the row keeps its height
  down to 320 px.
- The toolbar runs every action, the image actions and copy as text, through one guard that
  names the running action, so a share of a held file, a toast action, or a copy cannot start
  beside a capture.
- The toast stays the end state of every action, success or failure. The registration list copy
  in the plan menu and the copy subject id in the block context menu close their menu on press,
  so the toast alone reports them, as before. The copy subject id in the block details and the
  copy of quarantined data write a few characters or a recovery blob and keep their toast alone
  for now; they take the same pattern if they ever wait long enough to be seen.

Swapping only the glyph and keeping the label was rejected, because a spinner alone does not
say what is running, and the label fits at every width once its width is reserved. A minimum
display time for a busy state that ends within a frame was rejected, because it would delay a
result that is already done; such a copy reads through its toast as before.
