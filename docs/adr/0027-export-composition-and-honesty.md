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
