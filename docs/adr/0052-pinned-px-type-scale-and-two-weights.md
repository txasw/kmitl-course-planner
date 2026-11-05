# 52. Pinned px type scale and two weights

Status: Accepted
Date: 2026-11-06

Amends ADR-0004 (styling: Tailwind CSS v4). ADR-0004 pinned spacing to pixels and left the type
scale on the Tailwind defaults.

## Context

Brief section 8.2 asks for a 14 px base, grid labels at 11 to 12 px, one weight step for
emphasis, and never more than two weights on screen. The panel met none of that by construction.

The text utilities kept the Tailwind defaults, so `text-xs` and `text-sm` are rem values. A rem
resolves against the root of the host document, which the extension does not control, so the
panel's type changes with whatever root size the registration site sets. On phones the browser
text size adjustment can inflate the same text further.

The base was not where it appeared to be. WXT resets the shadow host with
`all: initial !important` before the extension sheet, so the `color` and `font-family` declared
on `:host` never reach the panel. The tree inside the closed shadow root starts at an inner `html`
element, and the panel inherits from that element: a 16 px base, the Tailwind preflight line
height of 1.5, and black text instead of the ink token. Every unclassed string in the panel was
therefore 16 px, not 14 px.

The weights had drifted to three. About sixty `font-medium` uses sat beside twenty
`font-semibold` uses and regular text in the same view, and two labels used `uppercase` with
`tracking-wide`, which has no meaning for Thai script and only spaces out the Latin half of a
mixed heading.

## Decision

Base on the inner root. The shadow tree's `html` element carries the base: font size 14 px, line
height 22 px, text size adjustment 100 percent, the ink color, and the font stack. The `:host`
rule keeps the design tokens only, since custom properties are the one thing the WXT reset does
not clear.

Pinned scale. The Tailwind text namespace is reset and redefined in px with line heights that
leave room for Thai stacked vowels and tone marks:

| Token       | Size  | Line height |
| ----------- | ----- | ----------- |
| `text-2xs`  | 11 px | 16 px       |
| `text-xs`   | 12 px | 18 px       |
| `text-sm`   | 14 px | 22 px       |
| `text-base` | 16 px | 24 px       |
| `text-lg`   | 18 px | 28 px       |

No other size utility exists. A px line height is inherited as a fixed length, so the weekly grid,
which is em scaled, sets a relative line height of 1.5 on its root and its labels stay as they
were.

Poster scope. The export poster keeps its `posterFontPx` scale and the line heights it had before
this record. Its root carries a `kcp-poster` class that restores the relative line heights for
`text-xs`, `text-sm`, and `text-base` inside the poster only, because Tailwind reads each line
height through a custom property at the point of use. The poster is a fixed canvas, so every pixel
its header, footer, and shelf rows gain is taken from the grid rows. Measured on the Share 16:9
template with the fit regression catalog, the px leading took about 0.8 px from each day row, and
the measured fit from ADR-0046, which sits within a pixel of the limit on a three hour block, then
dropped the English name and the time from every block while visible space remained. Export
geometry is owned by ADR-0043 and ADR-0046, so a change to the poster's leading belongs with
them, not with the panel type scale.

Two weights. The Tailwind font weight namespace is reset to `normal` 400 and `semibold` 600.
Every `font-medium` use maps by role. Semibold marks emphasis: headings and titles, form and field
labels, the section code, the subject id, status pills and badges, the credit total, the day
labels, the reason chip headline, the drag cards, and filled primary or danger buttons. Regular
covers everything else: outlined and quiet buttons, text links, segmented controls and tabs,
whose selected state is carried by fill rather than weight, and captions. The diagnostics drawer
and the quarantine card follow the same rule.

No uppercase. The catalog group heading and the plan menu label drop `uppercase` and
`tracking-wide`, and keep the semibold weight at `text-xs` in ink soft as the heading cue.

Guard. A Vitest test reads every source file under `src` and fails on `font-medium`,
`font-bold`, any other removed weight, and `uppercase`. It also asserts the pinned scale and the
two weights in the stylesheet, so the scale cannot drift back to rem or gain a third weight.

## Alternatives considered

Rem units were rejected because the host sets its own root size and the text size adjustment
inflates rem text on phones; px is the only unit that holds the panel still on any host page.

Declaring the base on `:host` alone, as first planned, was rejected once the WXT reset was found
to override it. Adding `!important` to the `:host` declarations would win against the reset, but
it would also defeat any later rule on the same element, so the base moved to the element that
actually roots the panel.

A unitless root line height, which would scale with every font size, was rejected for the panel
because the brief pins exact sizes and a fixed 22 px leading keeps rows of mixed Thai and Latin
text on one rhythm. The em scaled grid and poster are the two places where scaling is wanted, and
they opt in explicitly.

Letting the poster chrome take the px leading and relying on the fit to absorb it was rejected.
The fit never clips, so the export fit specs stay green, but the poster silently loses fields on
the default share template, which is a visible regression with no gain.

Keeping three weights and only documenting where medium applies was rejected because 8.2 sets the
limit at two, and the drift to sixty medium uses shows that a convention without a guard does not
hold.

## Consequences

Unclassed panel text drops from 16 px to 14 px and takes the ink color, and `text-xs` and
`text-sm` gain 2 px of leading. Rows, pills, and headings in the panel grow slightly taller. The
exported poster keeps its geometry, and its weights follow the two weight rule. The export fit and
template end to end specs still run on every change to this scale, together with a manual Thai
check of the A4 and phone wallpaper templates. A new component reaches for `text-2xs` for
quiet secondary lines rather than an arbitrary size. A new weight or an uppercase label fails the
unit suite rather than review.
