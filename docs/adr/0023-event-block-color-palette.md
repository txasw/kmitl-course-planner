# 23. Event block color palette

Status: Accepted
Date: 2026-07-08

## Context

Every placed section renders as a colored block on the timetable. The color has to
help a student tell subjects apart at a glance, stay the same for a subject across
renders and reloads so the grid reads consistently, and carry white text at a
readable contrast. The KMITL orange is the brand accent for the launcher, primary
buttons, the active tab, focus rings, and selection, so using it as a block fill
would blur the line between an interactive accent and a passive block.

## Decision

Color a block by a deterministic FNV-1a hash of its subject id, mapped onto a
curated palette of ten colors. The hash makes the mapping stable without storing a
color, and distinct subjects spread across the palette. The palette is fixed in
order so the mapping never shifts, every color clears WCAG AA contrast against
white block text, and the set excludes the KMITL orange. A unit test verifies the
contrast of every entry against white and holds a minimum pairwise perceptual
distance, so a future edit cannot lower the contrast or introduce a near duplicate
color unnoticed. The state tokens for the placement feedback, the success soft and
danger soft fills, are separate from this palette and are not part of it, so a
block fill never reads as a valid or blocked signal.

## Alternatives considered

Assigning colors in add order was rejected because the same subject would change
color between sessions and between plans, breaking the at a glance mapping. A
generated hue from the hash with no curated set was rejected because unconstrained
hues do not guarantee the contrast against white text or a readable spread, and
some land on the reserved orange. A larger palette was rejected because ten colors
already exceed the number of subjects a normal plan holds while staying distinct;
more colors would crowd the perceptual space and weaken the separation guarantee.

## Consequences

A subject keeps one color everywhere it appears, and the contrast and separation
are enforced by a test rather than trusted by eye. The orange stays unambiguous as
the interactive accent. When a plan holds more than ten subjects the hash reuses a
color, which is acceptable because the subject id and name on the block, not the
color alone, identify it.
