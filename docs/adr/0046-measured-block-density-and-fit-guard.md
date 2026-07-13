# 46. Measured block density and the export fit guard

Status: Accepted
Date: 2026-07-13

Amends ADR-0040 (event block layout) and ADR-0043 (export geometry).

## Context

A review of all six real exported PNGs from one populated plan found block text clipped mid
glyph. On the two shortest landscape canvases, Share 16:9 and the phone wallpaper landscape,
the foot lines, the subject id and the place, were cut across a glyph at the bottom edge of a
block. On the portrait phone canvas, long subject names clipped mid character at the right
edge of the narrow transposed day columns with no ellipsis.

The cause was that the density rule ADR-0040 and ADR-0043 both refer to did not exist as a
measurement. It was CSS only: the block box is a fixed height flex column with overflow hidden,
the time and name are pinned, and the foot is the only region that yields. Overflow hidden then
cut the foot across a glyph with no measurement and no whole line clamp. The name used a two
line clamp, which only ends in an ellipsis on a line count overflow, so a long unbreakable token
in a narrow column overflowed one line horizontally and was clipped rather than ellipsized.

The end to end suite did not catch any of this. The only preset spec decoded the PNG header
bytes to prove the canvas size and never measured a text node against its box, and nothing in
the capture path waited for fonts, so a block measured on a fallback font could differ from the
raster. The suite stayed green while the exports clipped.

## Decision

The density rule is realized as a measurement. Each block on the read only export poster
measures its own content against its box and drops whole low priority fields rather than
clipping a line. A field renders completely, every line fully inside the box including Thai
ascenders and descenders, or it is absent.

Drop priority, first dropped to last: the subject id, then the place line, then the section
chip, then the English secondary line, then the name reduces from two clamped lines to one,
then the name drops. The time is never dropped. Because the id drops before the place, a block
with room for one foot line keeps the place, which says where the class meets, while the id
stays recoverable from the text export. The priority lives in one pure module,
`lib/planner/blockDensity.ts`, as an ordered ladder, so it is unit tested apart from the DOM
measurement that walks it.

The measurement glue, `features/planner/useDensityFit.ts`, runs in a layout effect that resets
to the full field set when the inputs that size the box change and otherwise demotes one rung
while the content wrapper overflows, converging to a fixpoint before the browser paints. It
uses the scroll and client heights, which are the true template pixels because a wrapping
transform that scales the on screen preview does not change a descendant's layout box; the
bounding rectangle, which the transform would scale, is never used for the threshold. A block's
box size comes from the grid cell, not its content, so hiding a field never resizes the box and
the loop cannot oscillate. Because the poster box does not settle in one frame, the gallery
scale, the fonts, and the deferred neighbor posters resolve over the next few frames, a
ResizeObserver on the measured box resets the fit to full whenever the box resizes, so the
convergence re-runs against the settled size rather than a transient one; the observer fires
only on a real box change, never on a field drop. The whole mechanism is gated to the poster;
edit mode never measures and its rendering is unchanged.

Two supporting changes make the measurement valid. Long names and English lines wrap at any
point, so a long token wraps and the line clamp ends in an ellipsis rather than clipping a
glyph. The block line height on the poster is raised so stacked Thai vowels and tone marks sit
inside the line box, which is the precondition that makes the integer height measurement exact:
once the ink fits the line box, any real clip shows as a full line box overflow the measurement
catches.

The capture waits for fonts. `capturePng` awaits the document fonts ready promise and one frame
before rasterizing, and the fit measurement reads the same signal through a shared store, so the
field set the clone rasterizes is the one measured at the real glyph metrics.

A real fit guard replaces the header byte check as the coverage. A new end to end spec loads a
regression fixture that mirrors the shapes that clipped, three hour blocks, long Thai and
English names, Thai place strings, and a section pair, and for every preset asserts that each
block content wrapper on the offscreen poster has its scroll height within its client height and
that at least one wrapper is present, so a zero match cannot pass vacuously.

Finally, the subject id becomes a display option, off by default, that governs the poster, every
image export, and the copy as text output, so a shared timetable reads clean without the numeric
code unless the option is turned on. The edit grid ignores the option and always shows the id
for cross referencing against the catalog. When the option is on, the id is still the first
field the fit drops on a short block.

## Alternatives considered

An analytical fit from a single measured line height and a field count was rejected because it
would still have to measure the name's wrapped line count per block and then model inter line
gaps and the difference between a Thai and a Latin line box, with no tolerance for accumulated
sub pixel drift under a whole field or absent rule. CSS container queries were rejected because
their breakpoints are static pixel thresholds, so a long name and a short name in the same block
height would get the same field set when they need different ones, and the thresholds would need
hand tuning per canvas and font. The iterative measurement is the only approach that is at once
content aware, exact once the line height is adequate, and free of per canvas magic numbers.

Scoping the measured density to edit mode as well was rejected for this change: the finding is
about the export, the edit grid blocks are interactive with their full detail one hover or click
away, and keeping edit mode unmeasured avoids adding measurement to the interactive surface. The
latent edit mode clip, if any, is a separate follow up.

## Consequences

The poster and every image export drop whole fields by measurement rather than clipping, so no
block foot is cut across a glyph and no narrow column clips a name without an ellipsis, at any
of the six presets. Because the line height is larger and the id is off by default, some posters
show fewer foot lines than before, which is the completeness beats size trade from ADR-0043 made
exact. The export is now gated on fonts, a small delay when they are already loaded. The fit
guard fails when a block overflows its box, so a future regression is caught in the suite rather
than by eye. The block color system and the grid geometry are unchanged, which is why this
amends rather than replaces ADR-0040 and ADR-0043.
