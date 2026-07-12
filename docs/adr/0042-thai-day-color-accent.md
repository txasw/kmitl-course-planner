# 42. Thai day-color accent on export templates

Status: Accepted
Date: 2026-07-13

Records ruling one of the v1.2.0 design review.

## Context

The design review asked whether the weekly grid should color its days by the
traditional Thai day colors, in which each weekday has a customary color: Sunday red,
Monday yellow, Tuesday pink, Wednesday green, Thursday orange, Friday blue, Saturday
purple. The colors are culturally legible to a Thai audience and would make a shared
poster feel local. The risk is that the block fill already carries meaning: a block is
tinted by a stable hash of its subject id (ADR-0023, ADR-0035), so a subject keeps one
color everywhere. Coloring the day rows as well would put two color systems on the same
grid, and a reader could not tell whether a color meant a subject or a weekday.

## Decision

Block color stays subject identity. The Thai day colors survive only as a subtle accent
on the export template day-row labels, never on the blocks and never in edit mode. The
day label tint is defined in `lib/planner/dayColors.ts` as each saturated day color
composited over white to an opaque hex, the same tint-over-white technique the subject
block fill uses, so html-to-image inlines a stable fill in the capture. The accent is
gated to the template render through a `dayAccent` flag on the weekly grid, on only in
preview; edit mode keeps the plain alternating day rows so the day color never competes
with the subject-colored blocks while a plan is being built.

The tint is deliberately light so the ink label text clears WCAG AA for normal text on
every day; `dayColors.test.ts` enforces the ink-on-tint pair at 4.5:1 across all seven
days, and the accented label text is ink rather than ink-soft to keep a wide contrast
margin. Thursday's orange is close to the reserved KMITL accent, but it appears only as
a faint label tint in the exported poster, not as an interactive accent, so the two do
not collide in use.

## Alternatives considered

Coloring the blocks by weekday was rejected outright: it would overwrite the subject
identity color that the whole grid reads by, the review's stated concern. Showing the
day accent in edit mode too was rejected because the editing surface is where the
subject colors matter most and a second color system there is noise. A stronger, more
saturated day tint was rejected because it either fails AA against the label text or
starts to read as a meaningful fill rather than a quiet cultural accent.

## Consequences

A shared poster carries a familiar Thai day-color cue while the timetable a student
edits stays a clean single color system keyed to subjects. Because the accent lives on
the export template labels behind the `dayAccent` gate, a future decision to drop or
restyle it touches one flag and one small module, and the block color system is
untouched either way.
