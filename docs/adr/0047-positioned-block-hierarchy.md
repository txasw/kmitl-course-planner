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
numerals with a small clock glyph, beside the subject id when its toggle is on. The soft tint
fill, the solid left identity bar, and the color system from ADR-0035 are untouched.

Drop priority. The density ladder from ADR-0046 reorders to drop, first to last: the subject id,
the English name, the time, the section chip, then the name reduces from two clamped lines to
one, then the place. The name alone never drops. Two constraints are binding. The place outlives
the name's second line, since a one line ellipsized name still identifies the course while a lost
room is unrecoverable, so the name reduces to one line before the place can drop. And the time
never outlives the place, since the place is the field position cannot encode, so the time drops
before the place. The time is kept present as a quiet foot line rather than deleted, so a ninety
minute block still reads its exact minutes; this is the quarter hour caveat. The adjacent order
of the time and the section chip, one frees a flow line and the other frees corner width, may be
tuned from real renders, and the time is placed before the chip because dropping a flow line is
what relieves a vertical overflow.

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
