# 47. Positioned block hierarchy inverts

Status: Accepted
Date: 2026-07-13

Amends ADR-0040 (event block layout) and extends ADR-0046 (measured block density).

## Context

Inspecting the exports from ADR-0046, a ninety minute block on the Share 16:9 poster dropped the
place line while keeping the time line. That is the wrong trade. On a positioned block the row
and the block's own extent already encode the meeting time, so the time is the most redundant
field on the block, while the place, the building and room, is recoverable nowhere else on the
sheet. The layout gave the strongest slot, the top, to the time, the field position already
carries, and let the one irreplaceable field yield first. The hierarchy read backwards.

## Decision

On a positioned surface the block hierarchy inverts, because position carries the time. The one
shared block component changes across edit, preview, and export.

Anatomy. The subject name becomes the primary anchor at the top, strongest weight, clamped to
two lines with an ellipsis. The place is promoted to the second line at medium emphasis with a
small location glyph, building then room joined by a middot. The section stays a floating chip in
the top right corner. The time range demotes to quiet metadata at the foot in small tabular
numerals, beside the subject id when its toggle is on. The time carries no glyph: a glyph marks a
promoted field only, so the promoted place keeps its location pin while the demoted time reads as
plain tabular numerals, which identify themselves without one and spend no scarce width on a
field the layout deliberately quieted. The soft tint fill, the solid left identity bar, and the
color system from ADR-0035 are untouched.

Drop priority. The density ladder from ADR-0046 reorders to drop, first to last: the subject id,
the English name, the time, the section chip, then the name reduces from two clamped lines to
one, then the place. The name alone never drops. Two constraints are binding. The place outlives
the name's second line, since a one line ellipsized name still identifies the course while a lost
room is unrecoverable, so the name reduces to one line before the place can drop. And the time
never outlives the place, since the place is the field position cannot encode, so the time drops
before the place. The time is kept present as a quiet foot line rather than deleted, so a ninety
minute block still reads its exact minutes; this is the quarter hour caveat. The time drops
before the section chip for two reasons. First, geometry: dropping a flow line is what relieves a
vertical overflow, while the chip is a corner floater whose removal frees only corner width, so
on a block short in height the time is what needs to go. Second, disambiguation: on a block short
enough to force the choice, the section code is the remaining disambiguator between two sections
of one subject, while the approximate time is still recoverable from the grid axis, so the chip
earns the later rung.

Scope. The inversion applies only where position encodes time, the weekly grid in both edit and
preview. The hover detail card, the block detail popover, the catalog section rows, and the copy
as text line format keep the time prominent, because nothing spatial encodes it there; the
earlier reading order stays correct on those surfaces. The principle, stated in the component
doc, is that the time earns emphasis only where position does not encode it.

Wrap. A forced break within a name hyphenates by the text language: an English break inserts a
hyphen through hyphens auto with the correct language attribute rather than splitting a word with
no hyphen, and Thai keeps its native dictionary breaking. A within word break is the last resort
after word and hyphenation opportunities, and the clamped line still ellipsizes.

## Alternatives considered

Deleting the time entirely from a positioned block was rejected: a block spans whole quarter
hours, so its exact start and end minutes are not perfectly readable from the grid alone, and a
shared image should still state them. Keeping the time prominent and dropping the place under
pressure, the prior behavior, was rejected as the exact defect this record fixes. Applying the
inversion everywhere, including the hover card and the text export, was rejected because those
surfaces do not encode time by position, so their reading order should keep the time prominent.

## Consequences

A positioned block now leads with the course it names, promotes the room that nothing else
records, and keeps the time as a quiet but present foot line, so the strongest slot carries the
least redundant information. The change is contained to the one block component and its density
ladder; the color, tint, and left bar systems are unchanged, which is why this amends rather than
replaces ADR-0040, and the fit measurement and guard from ADR-0046 are unchanged, only the field
order they walk. The other detail surfaces are untouched.

## Amendment, 2026-11-20: soft depth blocks and names in full

The redesign of 2026-11-20 settles on soft depth for every card (ADR-0071), and it sets a hard
layout rule: no layout may overlap or clip text, and every label shows in full. A gate pass then
found long Thai names breaking one character per line in the phone week view and in the plan
suggestion mini grids. The cause was the 1.5rem right padding the name kept clear of the floating
section chip: in a 60 px day column it left the name about 18 px, so every glyph wrapped alone.

Fill. The edit grid and the plan suggestion cards fill a block with the soft depth card, the
tinted gradient, tinted edge, white top highlight, and light shadow of ADR-0071, tinted by the
subject color, with a 3 px stripe of the solid color down the left edge in place of the 4 px bar.
The preview poster and its export keep the flat tint and bar of ADR-0035, because the capture
inlines a concrete hex fill and a gradient over color-mix would put the raster at the mercy of the
capture library; the redesign mockup also leaves the poster block out of the soft style.
The danger state moves its inset ring from the block onto the hatch overlay, since the soft card
draws its edge with box-shadow and a ring on the block would replace it. Over the hatch the quiet
lines switch from ink soft to ink, because ink soft falls under 4.5:1 on a hatch stripe; the flat
tint had the same gap, and docs/CONTRAST.md lists every pair.

Anatomy. Nothing is positioned over text. The section chip leaves the corner and trails the place
at the end of the same wrapping row, and starts the row when there is no place. The status dot
leaves the corner and leads the name in flow. The name keeps a right reserve only where the remove
control can show, a fine pointer on a block at least 7em wide, and the chip steps aside while that
control shows, as the corner chip did. Every field wraps rather than ellipsizes: the place, the
English line, and the subject id lose their single line truncation, and an empty foot is left out.
The subject id later became a whole field on one line again, shown whole or dropped whole, in the
ADR-0046 amendment of 2026-11-20.

Names in full. At full density the name is no longer clamped. The ladder gains a rung after the
time drops: the name clamps to the lines that fit, measured in one step from its line height and
the overflow, never below two lines while the section chip shows. The rest of the ladder holds,
so the drop order is the subject id, the English name, the time, the name past its second line,
the section chip, the name to one line, then the place, and both binding constraints stand. A name
the box cannot hold is clamped with an ellipsis, and the block itself is the expand affordance: it
opens the full detail in edit, and a suggestion slide names every section in full in its
placed list (ADR-0054, amendment of 2026-11-20 on one suggestion per slide).

Narrow blocks. Where the block width is a day column or a suggestion slide track, the portrait edit
grid and the plan suggestion slides, a block narrower than 7em, measured by a container query on the
block wrapper in em of the grid type size, shows the name alone at 0.9em with tight padding, the
shape the mockup gives the phone week and the suggestion slides. The place row, the English
line, the foot, and the remove control hide there; the block opens its details, which carry them
and Remove, the same path ADR-0058 gives a coarse pointer. A landscape grid never takes the rule,
in edit or on the poster, because there a block is as wide as its meeting is long: a 60 minute
meeting is about 56 to 75 px across the edit grid and the Share 16:9 and Print A4 posters, under
7em, and a name only block would drop the place before the name's second line, breaking the
binding constraint above, on the exported image too, where the fit guard cannot see a hidden
field. A short landscape block walks the density ladder instead. The name breaks at the
browser's dictionary word boundaries for Thai and at spaces for English, and a break inside a
word stays the last resort, for a word wider than the whole line. The API sends English names in
capitals, which Chromium does not hyphenate, so an English word wider than a phone
week column breaks inside the word with no hyphen. A layout check at 360, 390, 768, and 1366 px
found no break inside any word, as Intl.Segmenter bounds it, that fits its line, so inserting
break hints from Intl.Segmenter would add nothing over the native breaker in Chromium; keep-all
was rejected because Thai has no spaces for it to break at. Hiding the name for the subject id in
a block too narrow for one word was rejected because the eight digit id is as wide as the longest
common Thai words, so it would trade a readable name for an id that wraps too.

Consequences. The phone week and the suggestion grids break names between words wherever a word
fits the column. In a five to seven column phone week, a word wider than the column, such as
ประสบการณ์ or an all capitals English word, still breaks inside the word, since the column holds
about 40 px of text; the day view, the default on a phone, shows every name in full. The poster
gains the chip in flow and the unclamped name but keeps its flat fill, and its fit guard holds.
The blocking pulse and the locate ring draw with box-shadow outside any layer, so for their 600 ms
they replace the soft card's edge, highlight, and shadow with the ring, and under reduced motion
the locate ring holds still for the same time; this is accepted, since the ring is the message
while it shows and the card returns when the class drops. A browser check in the responsive
suite reads the laid out names of the suggestion slides and the phone week and fails on a
clipped name or a line holding one grapheme of a longer word, and a desktop check keeps the place
on a 60 minute landscape block.

## Amendment, 2026-11-21: English words stay whole

Context. A conformance review of the redesign read the phone week and the suggestion slides in
English at 360 and 390 px and found names broken inside words with no hyphen, among them
INTRODUCTION TO COMPUTE then R and PSYCHOLOG then Y, a single letter stranded on its line. The
owner's rule is that no text shows incomplete at any width in Thai and English, and the block name
guard counted only the single stranded letter, and only in the Thai interface.

Decision. An English name breaks only at its spaces. It no longer takes `overflow-wrap:
break-word`, so a word wider than the name's line overflows the name, and the measured fit reads
that overflow from the name itself, ahead of the height walk, as it reads a whole field. The name
form then steps down: first one type step smaller, 0.9em of the block, then the subject id in the
name's place on one line that never wraps, one type step smaller, and last, where even the id is
wider than the line, no text. The id leaves the foot while it stands in for the name, so it never
shows twice. A block with no name text keeps its color, stripe, status dot, and accessible name,
and opens the full detail like any block. A Thai name keeps the browser's dictionary breaks, and a
Thai word wider than the whole line still breaks inside the word as before, since the Thai break
falls between whole graphemes and Thai has no spaces to fall back on. The secondary name joins the
whole fields: it wraps only between its words in either language and drops whole when a word is
wider than its line, before the ladder walks.

This supersedes the rejection above of the subject id in a block too narrow for one word for
English names only. The reason given there, that the id wraps too, does not hold: the id is one
whole field on one line that never wraps, and a block too narrow for it shows no text rather than
a broken code.

The block name guard reads English as well as Thai: a name that is not Thai fails on any word
whose letters run over two lines, and the clipped text sweep runs the guard on the timetable, the
phone week, and the suggestion slides at 360, 390, 768, and 1366 px in both languages.

Consequences. In a five column phone week at 360 and 390 px most English course names have a
word wider than the column, so those blocks read as the subject id, and the day view, the phone
default, shows the whole name. A one hour landscape block whose English name holds a long word
reads its name a step smaller or as the id. No English block name breaks inside a word anywhere.

The name form follows the measured fit on every surface that shares the block content, the
preview poster and its export included. On a poster a block whose English name holds a word wider
than its column, such as the portrait phone wallpaper in English, reads the subject id in the
name's place even while the show subject id display option is off: the option governs the id in
the foot, and the id here stands in for a name that cannot show whole, so the block still names
its course. The clipped text sweep runs the block name guard on every export template too.

The rule reads the script of the name as well as its field. International programs send the
Thai name field in Latin capitals, 66 of the 164 distinct Thai names in the captured catalogs, so a
Thai field with no Thai letter keeps its words whole like an English name and steps its form down
the same way, and the guard holds it to its word boundaries too. A Thai name that holds a long
Latin word inside Thai text keeps the Thai breaks, so that word may still break inside itself where
it is wider than the whole line, and the guard does not report it. One captured name has that
shape, a Thai title that ends in EDGE COMPUTING. Splitting one name into runs of two wrap rules
would cost more than the rare broken word it saves, so the case is accepted and stated here.

## Amendment, 2026-11-21: text over the danger hatch sits on a solid backdrop

Context. The same review found the hatch stripes of a missing or conflicting block running
through its text. Switching the quiet lines to ink kept the contrast on a stripe, but the stripes
still crossed the glyphs and made a dense Thai name hard to read.

Decision. Over the hatch the block content is positioned so it paints above the overlay, and each
text line, the name, the secondary name, the place row, and the foot, sits on a solid backdrop as
wide as its text and never wider than the column, so the hatch shows around the text and beside a
short line. The backdrop is the soft card's top tint made opaque, and the text keeps the ink the
contrast tests prove on the card fill. Only the soft card needs it: the flat fill renders on the
preview poster and its export alone, and that path draws no hatch (ADR-0055).

Consequences. A hatched block in the edit grid reads as text on its fill with stripes in the
gaps. The ring and the stripes still mark the block as missing or in conflict.

## Amendment, 2026-11-21: the phone day card

Context. The day view of ADR-0049 renders one day in portrait, so each block is the full width
of the pane and about 70 px an hour tall. The conformance review found the block laid out as the
narrow positioned block stretched: the name, the second name, the place, and a bare section code
crowded the top fifth of a three hour card and the rest of it stayed empty.

Decision. In the day view a block lays out as the day card of the redesign mockup. A single day
column leaves the time axis far from the text, so the time range leads as a clear first line in
the semibold weight. The name in the panel language follows, then the other language's name, then
the place with its location glyph. The section, named as กลุ่มเรียน with its code, and the lecture
or practice kind sit as chips at the foot of the card, with the subject id at the end of that line,
so a long meeting reads as one card from top to bottom. The fill, the stripe, the status dot, the
hatch, the drag, and the remove control are unchanged. The card walks the density ladder in its
own order, kept in blockDensity beside the positioned order, because the time leads here: a short
meeting drops the id, the second name, the name lines past the second, the chips, the name to one
line, the place, and last the time, so a one hour card keeps its time, a one line name, and its
place. The time and the id remain whole fields. The week grid, the poster, and the suggestion
slides keep the positioned block layout and its order, where position encodes the time.

Alternatives considered. Keeping the positioned layout with the foot pinned to the bottom was
rejected because the time would stay demoted in the one view whose axis is furthest from the text.
A right column for the time and the place, as the mockup's first sketch drew it, was rejected
because a long Thai name then wraps in half the width.

Consequences. The phone day view reads like the mockup screen 04. The time is prominent here
while it stays quiet in the week, which follows this ADR's rule that the time earns emphasis
only where position does not encode it clearly.

## Amendment, 2026-11-22: the name always shows

Context. The owner reviewed the redesign and ruled that the subject name is the most important
thing on a timetable and must always show. Under the amendment of 2026-11-21 an English name with
a word wider than its line read as the subject id in the name's place, and as no text where even
the id was wider, so the phone week, the suggestion slides, short blocks, and the export poster
could show a block as a bare code. The owner cancelled every place where the id stands in for the
name.

Decision. The name never yields. Where a word of the name is wider than its line, the name form
steps from the full name to one type step smaller, then, for a name in Latin script, through its
abbreviated forms at that size, least shortened first, and last to the break form, which keeps the
shortest of those forms and lets the word still too wide break at grapheme cluster boundaries. A
Thai name keeps the browser's dictionary breaks and has no abbreviated forms, so it goes from the
smaller step to the break form of the whole name. The abbreviation is a pure function in
`lib/planner/abbreviateName.ts`: a word of three letters or fewer, the joiners WITH, INTO, FROM,
and ONTO, and a capital Roman numeral to XXXIX stay whole, since a cut VIII reads VI; every other
word is cut to a cap of letters and a period, moving back past a vowel it would end on, and the
forms lower the cap one letter at a time from one that shortens only the longest words, down to two
letters, so INTRODUCTION TO COMPUTER PROGRAMMING FOR ENGINEERS reads INTR. TO COMP. PROG. FOR ENG.
at a cap of four. The fit tries each form in turn and keeps the first that fits. The full name
stays in the block's accessible name, its hover card, and its details. The subject id is its own
field again on every form, governed by the show subject id option and still the first field to
drop, so it never shows twice and never stands in for the name. The narrow block rule is unchanged:
a narrow block still shows the name alone, now always as its name.

This supersedes, from the amendment of 2026-11-21, the subject id in the name's place, the empty
name, and the poster reading the id while the show subject id option is off. The name form
follows the same rule on every surface that shares the block content, the edit grid, the phone
day card, the suggestion slides, and the preview poster and its export.

The block name guard asserts that every shown name has text that is not the eight digit id alone.
The word and single grapheme rules still apply to every form but the break form, and the break
form is reported only where its text would fit the line unbroken, so a break inside a word fails
the guard whenever an abbreviated or smaller form would have fit.

Alternatives considered. Keeping the id as a last fallback below the abbreviations was rejected
because it is the exact reading the owner asked to remove. Abbreviating Thai names was rejected
because a cut Thai word does not read as an abbreviation and Thai has no capitals or spaces to cut
at. Cutting every long word to one fixed length was rejected because it shortens a name further
than its line needs; the stepped forms keep the longest one that fits.

Consequences. In a five column phone week at 360 and 390 px most English course names read as an
abbreviation rather than an id, and the day view still shows the whole name. A name in the break
form can still break inside a word where a column is narrower than its shortest form, and the
block name guard allows that only where no shorter form fits the line. The fit takes up to
one pass per abbreviated form on a block that needs them, a bounded few layout passes, since each
form is tried once per reset.

## Amendment, 2026-11-22: the poster follows the soft style

Context. The owner found the exported image still in the old design. The soft depth amendment of
2026-11-20 had kept the flat tint and 4 px bar on the preview poster and its export, on the
grounds that a gradient over color-mix would leave the raster at the mercy of the capture
library. The owner picked the soft depth set, direction B of ADR-0071, for the whole product,
and a shared image that looks unlike the timetable it came from reads as a different product.

Decision. The poster blocks take the same soft depth block as the edit grid: the subject tinted
gradient, the tinted edge, the white top highlight, the light shadow, the 3 px stripe, and the
section chip as an outline of the tint with ink soft text, so the poster keeps the edit text
hierarchy. The flat surface and its prop are removed, so every grid paints one block. The
capture inlines each element's computed style, where the gradient, the edge, and the shadow have
already resolved to concrete colors. Exported PNGs of every template in Thai and English were
compared with the edit grid, and the light shadow renders cleanly, so it stays. A standalone
check rasterized the same card through the capture library in Firefox and Chromium and read the
same pixels within one level per channel. The capture paints the poster over white, which is
the surface the stops mix into, so the image carries the stops the palette suite proves.

The poster frame follows. The unscheduled shelf and the exam schedule block take the quiet card,
the treatment of the exam day cards in the plan views, in place of a 1 px border; the shelf does
so in edit as well. Each export day label sits on a soft tile of its Thai day color (ADR-0042)
in place of a flat band filling its cell, and the portrait day row grows to 2.25em on the poster
so the tile holds its padding around a full Thai line. The header and the footer keep their
hairline rules, the same rule the soft set draws under an exam day header.

The export comparison also found a raster fault that the flat chip had hidden. The place row
pushed the section chip right with an auto margin, which the capture inlines as the pixels it
resolved to. A row that measured a fraction wider in the raster wrapped the chip onto a line
the block clips, so the image showed a sliver of the outline, or nothing under the flat fill,
where the screen showed the section. The row now spreads the place and the chip with
justify-between, which inlines as a keyword and leaves the free space as slack, and a chip that
wraps on a narrow block starts its own line under the place in edit and on the poster alike.

Alternatives considered. Computing the soft card stops as concrete hex values in script for
the poster alone was rejected: the capture already reads resolved colors, and a second copy of
the card would drift from the stylesheet. Keeping the flat day bands was rejected because they
read as the old design beside soft blocks.

Consequences. The exported image matches the edit grid. The measured fit and its guards are
unchanged, since the card draws its edge inside the box as the flat fill did and the padding
holds. The day tiles are a quieter accent than the bands were. The flat tint remains in the
palette tests only for the landing page block mockups.
