# 44. Block redesign, hover detail card, and plan creation flow

Status: Accepted
Date: 2026-07-13

Amends ADR-0040 (event block layout).

## Context

The v1.2.0 second-wave review approved three design changes gated on this record: a block
redesign to a clearer hierarchy, a hover detail card so a look at a placed block no longer
needs a click, and a plan creation flow that leads with create rather than burying it in an
icon row.

## Decision

Block redesign. The time range is the colored bold anchor with a small clock glyph in the
subject colour, the subject name is the primary full weight line, the subject id and the
place read as quiet metadata at the foot, and the section is a small floating chip in the
top right corner that steps aside on hover and focus so the remove control takes that corner.
The soft tint fill and the solid left bar from ADR-0035 and the density rule from the first
wave still govern, so the time and the name are pinned and never clip. The time text stays
ink for AA on the tint; the colour is carried by the clock glyph and the left bar, which
clear the 3:1 UI bar on every tint. One component still serves edit, preview, and export.

Hover detail card. After a short delay on a hovered block, the grid opens a read-only card
with the full detail set, times, room and building, teachers, seats, exam ranges, and
verification state, read from the same plan entry snapshot the block detail popover reads.
The click and keyboard paths to the popover stay for pinning and actions. The card is
positioned to the side so it never sits under the pointer, dismisses on leave and on Escape,
and carries a neutral info accent, a left border in the brand, so it shares a family look
with the danger drag conflict card but reads apart from it at a glance. The hover intent is
managed by the grid, one card at a time, never during a drag, so no per-block floating
instance is created.

Plan creation flow. Create becomes one prominent full width tinted button at the top of the
plan menu. Rename, duplicate, and delete move to per-plan-row actions that appear on hover
and focus of each row, icon buttons with tooltips that name the plan they act on; delete
keeps its confirm, now threaded with the target plan id rather than the active plan. Import
and export JSON stay at the foot. The row reveals its actions on focus, so every per-row
action is keyboard reachable.

## Alternatives considered

Colouring the time text in the subject colour was rejected because two of the ten palette
colours fall below the 4.5:1 text bar on their tint; the colour rides the glyph and the bar,
which carry the 3:1 UI bar. A per-block hover card with its own floating instance was
rejected for the cost of many instances on a dense grid; a single grid-managed card with a
hover delay is lighter and avoids flicker as the pointer crosses blocks. Keeping create in
the icon row was rejected because creating a plan is the primary action of the menu and
should read as such.

## Consequences

A block leads with when and reads its name as the primary content, a placed block reveals
its full detail on hover without a click, and the plan menu leads with create while its
per-plan actions are one hover or focus away on the row they act on. The block colour system
and the density rule are unchanged, which is why this amends rather than replaces ADR-0040.

## Amendment, block chrome simplification

The corrected build showed the hover card made the block's info affordance redundant: two
paths to the same detail sat on the block at once. The info control leaves the block chrome.
The block itself becomes the button: a click or Enter or Space on the focused block opens the
pinned detail popover, which stays the keyboard path to details and actions, and the context
menu keeps its two entries. The only chrome control that remains is the quiet remove button.

Two rules follow. The hover card never spawns while a popover is pinned, so the two detail
surfaces never show at once; the grid drops the card and any pending hover the moment a
popover pins. And to keep the block itself a button without nesting one interactive control
in another, which axe flags and screen readers mishandle, the remove button is a sibling of
the block button rather than a descendant: a thin positioning wrapper carries the grid
coordinates and the hover group and holds both. The hover card already sits to the side of
the block with an offset, so it never covers the remove control.
