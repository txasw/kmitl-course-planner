# 40. Event block layout redesign

Status: Accepted
Date: 2026-07-13

Amends ADR-0023 and ADR-0035.

## Context

The placed block grew as a cramped cluster in the top left: the subject id and
section on one line, the short name on the next, and the room last, all left
aligned and clipping the room first as the block narrowed. A post release design
review found the hierarchy unclear and two facts underused. The time range was
computed only for the accessible label and never shown, and the building was
normalized end to end (`Meeting.building`, from `building_no` then `classbuilding`)
but never rendered, so a room alone did not say which building it was in.

The color system is not in question. ADR-0023 fixed the ten color palette and its
stable hash, and ADR-0035 moved the block to a soft tint fill with a solid left bar
and ink text. Both stand. What reads poorly is the arrangement of the content, not
the color.

## Decision

Keep the palette, the hash, the tint fill, and the left bar from ADR-0023 and
ADR-0035 unchanged. Restructure the block content into a clear hierarchy with the
emphasis order time, place, subject: the time range leads in a semibold line, the
subject name is the primary content clamped to two lines rather than a single
truncated line, and the subject id, a small section chip, and the place read as
quieter meta pushed to the foot of the block. The place joins the building and the
room with a middot, so a block now says both where in a building and which building;
either can be empty on an online course, and the separator appears only when both
are present. The block still clips from the foot inward as it shortens, so the time
and the name survive on a short block.

Contrast follows the change. The time, the name, and the section chip stay ink on
the tint, already proven at 4.5:1. The quieter meta, the subject id, the place, and
an English secondary name, use ink soft, which clears 4.5:1 on every tint with a
minimum of 5.21; `hash-color.test.ts` now enforces the ink soft on tint pair beside
the ink pair, and `docs/CONTRAST.md` records it.

The block remains one presentational component across edit, preview, and export, so
the redesign reaches all three surfaces at once, and `hashTint` still returns a
concrete opaque hex so the exported image matches the screen.

## Alternatives considered

Rendering the building on its own line was rejected because the room and the building
are one fact, the place, and a separate line spent scarce vertical space; the middot
join keeps them together. Adding a display option for the building was rejected
because the room toggle already governs whether the place shows, and a second toggle
for half of the place would confuse the option set. Keeping the single line truncated
name was rejected because a two line clamp shows far more of a long Thai name in the
common tall block.

## Consequences

A block now leads with when and reads the name as its primary content, and it finally
shows the building it was always carrying. The palette and tint tests from ADR-0023
and ADR-0035 still hold; only the layout and the enforced text pairs change, which is
why this amends rather than replaces those records. A future density rule that reacts
to the column span builds on this foot inward clipping rather than the old room first
clipping.
