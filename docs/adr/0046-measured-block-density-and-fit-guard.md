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

## Amendment, 2026-11-20: whole fields by width, the name language, and fewer options

Owner feedback on the redesign train named two export faults. A subject code clipped on the
small exports: the ADR-0047 amendment of the same day had let the id wrap rather than truncate,
so on a one hour landscape block the eight digits broke across two lines, which reads as two
codes, and the fit measured only height, so a field could also run past the right edge unseen.
And the poster could name subjects only in the panel language, with English as an optional
second line under Thai alone, so a student browsing in Thai could not share an English
timetable, and one browsing in English could not add the Thai names.

Whole fields. The subject id and the time are whole fields: each sits on one line that never
wraps and clips its own overflow, so the fit can read its scroll width against its line. A whole
field wider than its line drops at once, whole, out of ladder order, since no rung can widen its
line; this supersedes the ADR-0047 amendment's wrapping id. The content wrapper's own horizontal
overflow now walks the ladder exactly as a height overflow does, so the fit reads both axes. The
fit guard checks both axes at every preset and in every name language, asserts that each whole
field present fits its line on one line and that every id shown is its full eight digits, and
that at least one id shows per preset so the check is never vacuous. The synthetic fit
regression catalog gains a one hour and a ninety minute block, the narrow landscape shapes the
id clipped on.

Reclaim. Once the content fits, the fit offers back, once each, the time, the secondary name,
and the subject id it dropped on the way down, in that order, because a later rung such as the
secondary name or the name clamp may have freed the room an earlier drop needed. These are the
three top rungs, each the first field the ladder drops while shown, so an offer that overflows
is undone by the next demotion and never costs a field ranked above it. Without the pass, a name
language of both cost a Share 16:9 block its id even though the second name never fit there.
The pass offers nothing once the walk has dropped the section chip or the place: past that
point a returned field would show while a field the ladder ranks higher stays hidden, and on a
short block whose place wrapped, the one line time could return in the room the place left,
showing the time without the place, which ADR-0047 forbids.

Name language. An export option names every subject in Thai, English, or both, and applies
identically to the poster, the PNG, the copied image, the unscheduled shelf, the exam block, and
the copy as text output through one resolver, `lib/planner/nameLanguage.ts`. Unset, the default,
it follows the panel language. Both leads with the panel language and adds the other language as
the secondary line, which takes the English line's rung in the ladder, so it shows where the fit
allows; the text export has no box to fit and always carries both. A single language falls back
to the other language when its own name is empty, so a block is never nameless. The choice is an
optional display options field that reads an unknown value as absent, so no schema version bump
is needed: a blob written before it loads whole and follows the panel language. The retired
English names switch is not mapped onto the new choice, so a student on the Thai panel who kept
its old default, English names on, now gets a Thai only poster until they pick both. This is
intended: the default follows the panel language in both locales.

Both costs ids where its second line fits. The secondary name ranks above the subject id in the
ladder, so the reclaim pass returns the id only where the second line itself did not fit. Where
it fits, it takes the room the id had. With show subject id on, the review exports of the fit
regression catalog show this on the phone wallpapers. In landscape on the Thai panel, ids show
on six blocks under Thai names and on two under both. In portrait, the one hour block of
`90000605` loses its id the same way. On Share 16:9 the second line never fits, so both renders
pixel identical to the single language there.

Fewer options. The display options keep only what the fit can still change: the name language,
then the room, the section, the subject id, and the exam schedule. Show English names is
retired, since the name language covers it in both panel languages; the object schema strips the
stored key, so an older blob loads with every other choice intact. The unscheduled shelf wraps
its names rather than truncating them, since the shared image has no hover to expand a cut name.

Alternatives considered. The agreed redesign mockup disables both on Share 16:9 and the phone
wallpaper landscape, with a note saying why. This change keeps both available everywhere, and
that is an open decision for the owner rather than a settled one. On Share 16:9 both is
harmless but does nothing. On the phone wallpapers it trades subject ids for second names, as
above, and the option note says only that the second name shows where a block has room, not
that it can take an id's place. The mockup also moves an id that does not fit into a legend
under the poster and labels the switch as showing subject ids below the image. That is left
out of this change: the task asked for an id that does not fit to drop whole, the text export
always carries the id, and a legend takes height from the grid on exactly the templates short
of it. Whether to follow the mockup on either point is the owner's call. Letting the id wrap at
a narrower type size was rejected because a code split at any size still reads as two codes.

## Amendment, 2026-11-22: the id never takes the name's place

The owner ruled that the subject name must always show on a timetable block (ADR-0047 amendment
of 2026-11-22). The drop priority of this ADR is unchanged and the name still never drops, but
the name form no longer steps to the subject id or to no text. A name with a word wider than its
line steps one type size smaller, then through its abbreviated forms for a name in Latin script,
then to a break form as the last resort. The subject id is only ever its own whole field, shown
under the show subject id option and dropped first, so the reclaim pass offers it back on every
name form. The fit reset key carries the name itself, so a change of name, such as a locale
switch, fits the new name afresh from the full level. The fit guard and the clipped text sweep
run the block name guard, which now fails a block that shows no name or the id alone, on every
export template.

## Amendment, 2026-11-22: under both names the poster drops the time first

The 1.6.0 release gate found that with subject names set to both, the landscape posters (Share
16:9, Print A4, and the phone wallpaper landscape) dropped the second name on most blocks while
they kept the time line. The block's row and extent already state the time (ADR-0047), so a
student who chose both got an image that looked like a single language export, with the one line
the sheet repeats still in place. On a poster block with the name language set to both, the time
now drops before the second name: the subject id goes first, then the time, then the second
name, and below those rungs the order is unchanged, so the primary name still never drops and
the place still outlives the name's second line. The reclaim pass offers the second name back
before the time on such a block, so a block with room for one of the two keeps the name. The edit
grid, the suggestion grids, the day card, and a poster set to one language keep their orders; the
edit block's hover card and details carry both names, and a single language poster has no second
name to rank.

Measured on the fit regression plan, the Share 16:9 export now shows both names on three of the
five three hour blocks in Thai and in English, against none before, Print A4 on two of them, and
the phone wallpaper landscape on all five. A block whose two names take four lines together, such
as a two line Thai workshop name over a two line English one, still has no room once the time has
gone, so it drops the second name whole as before and takes its time back through the reclaim
pass.

Alternatives considered. Stepping the poster type scale down one size before the second name
drops was rejected because it changes the type of every block on the sheet to serve a few. Letting
the second name clamp to one line with an ellipsis was left out, since the word rule holds the
second name to a whole field and an ellipsized second name reads as a cut one in a shared image.
