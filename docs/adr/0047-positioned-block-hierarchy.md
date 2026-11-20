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

Names in full. At full density the name is no longer clamped. The ladder gains a rung after the
time drops: the name clamps to the lines that fit, measured in one step from its line height and
the overflow, never below two lines while the section chip shows. The rest of the ladder holds,
so the drop order is the subject id, the English name, the time, the name past its second line,
the section chip, the name to one line, then the place, and both binding constraints stand. A name
the box cannot hold is clamped with an ellipsis, and the block itself is the expand affordance: it
opens the full detail in edit, and a suggestion thumbnail offers its full size card.

Narrow blocks. Where the block width is a day column or a thumbnail track, the portrait edit grid
and the plan suggestion cards, a block narrower than 7em, measured by a container query on the
block wrapper in em of the grid type size, shows the name alone at 0.9em with tight padding, the
shape the mockup gives the phone week and the suggestion thumbnails. The place row, the English
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
suite reads the laid out names of the suggestion thumbnails and the phone week and fails on a
clipped name or a line holding one grapheme of a longer word, and a desktop check keeps the place
on a 60 minute landscape block.
