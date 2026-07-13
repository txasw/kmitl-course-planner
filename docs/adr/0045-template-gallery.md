# 45. Template gallery: canvas orientation and the picker as preview

Status: Accepted
Date: 2026-07-13

Amends ADR-0041 (export templates) and ADR-0043 (export geometry).

## Context

The v1.2.0 template set had two presets that drew a landscape table on a portrait shaped
canvas: the phone wallpaper (1080x2340) and the tablet wallpaper (1668x2388) both laid out
days as rows on a tall box, so the grid read as a thin band across the top. The template was
also chosen from a dropdown with a separate corner size label, which asked the user to pick a
size blind and read the result elsewhere.

## Decision

Axis orientation follows canvas orientation. This is one rule, stated once in the template
module doc comment, that every future preset inherits without a new decision: a landscape
canvas keeps normal axes, days as rows and time as columns; a portrait canvas transposes,
days as columns and time flowing down, so a tall canvas fills top to bottom. The orientation
field therefore always matches the canvas aspect, portrait when the layout box is taller than
wide and landscape when wider than tall, which a unit test asserts across the whole set.

The six preset set, named by use case with no device brand and no custom sizes:

| Template                   | Output           | Orientation |
| -------------------------- | ---------------- | ----------- |
| Share 16:9                 | 1920x1080        | landscape   |
| Phone wallpaper landscape  | 2400x1080 (20:9) | landscape   |
| Phone wallpaper portrait   | 1080x2340        | portrait    |
| Tablet wallpaper portrait  | 2048x2732        | portrait    |
| Tablet wallpaper landscape | 2732x2048        | landscape   |
| Print A4                   | 3508x2480        | landscape   |

The phone landscape is a true wide canvas, the rotate to view fullscreen image; Share 16:9
already covers classic 16:9, so one phone landscape preset suffices and a 21:9 device takes
minor letterboxing, which is acceptable. The tablet splits into a portrait and a landscape
preset on the common 4:3 panel; the portrait tablet transposes like the phone portrait, which
is the layout a tall canvas exists for. Every layout width stays at or above the grid's 44rem
minimum.

The picker becomes the preview. The dropdown and the corner size label are retired. The
preview pane renders the selected template poster centered with the adjacent templates peeking
at both edges. Pointer swipe and the left and right arrow keys page between them, and a dot
row beneath allows direct jumps, each dot tooltip named, with Home and End jumping to the
ends. The pager is a radiogroup and the dots are its radios, fully keyboard operable with a
visible focus ring. A caption under the preview carries the localized template name with its
exact pixel dimensions, which is where the retired corner label's information goes. Only the
selected poster renders eagerly and holds the capture node; peeking neighbors preload lazily,
and each poster memoizes on the plan revision and the display options, so changing a display
option re-renders at most the visible poster immediately. The last used template persists as
before, and reduced motion swaps the slide for an instant switch.

## Alternatives considered

Keeping the tablet as one preset was rejected because a single orientation cannot serve both
the portrait and the landscape use of a tablet, and the old single preset drew the wrong axes
for its canvas. A free orientation toggle was rejected earlier and stays rejected: orientation
is a property of the named canvas, not a control. Keeping the dropdown was rejected because a
size picker that shows nothing of the result asks the user to choose blind; making the preview
itself the picker shows each template as it will export.

## Consequences

Every export canvas now reads in the orientation its name implies, and the set covers phone
and tablet in both orientations plus share and print. The user pages through the templates as
posters and reads the exact output size in the caption, so the choice is made by sight. The
one axis rule in the module doc means a future preset needs only its box and ratio, never a
new orientation decision.

## Amendment, gallery hierarchy, affordances, and the footer

The first gallery sized each neighbour by its own width, so a portrait neighbour rendered
nearly as large as the selection and inverted the emphasis. The hierarchy is fixed to an edge
anchored sliver: the selected poster is always centred, full height, and unclipped, within the
width left after a reserved zone at each edge; the previous and next templates show only a
constant 44 px sliver at each edge, cropped by the frame, dimmed to 0.4 opacity and scaled to
0.9 of the selection height, so they read as continuation cues, not comparable options. The
switch keeps the reduced motion aware settle, so reduced motion stays instant.

Paging gains visible affordances beside the keyboard and swipe paths: a previous and a next
arrow button flank the gallery, named and tooltipped, disabled at the clamped ends to match the
boundary, and paging exactly like the arrow keys; and a scroll wheel over the gallery pages
horizontally, a vertical notch or a horizontal trackpad swipe, with a cooldown so one notch is
one page. The dots, Home, and End remain.

The export footer becomes one baseline row inside the poster's equal margins: the credits
summary flush left and the watermark flush right, sharing a baseline and a single top divider.
The watermark mark is the extension's own icon as a monochrome, single colour variant in the
credit text colour, sized to the text cap height, replacing the generic glyph.
