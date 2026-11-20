# 71. Soft depth tokens and cool neutrals

Status: Accepted
Date: 2026-11-20

Extends ADR-0029 and ADR-0051 (the tested design token contrast pairs).

## Context

The redesign of 2026-11-20 settles on one card treatment for the whole panel, called soft depth:
a soft tinted fill, a soft edge, a light shadow, and airy spacing. It chooses cool neutrals for
every grey. It also sets one hard layout rule that later component changes must keep: no layout
may overlap or clip text, and every label shows in full.

The current tokens cannot express that treatment. There are two text steps, ink and ink soft, but
the redesign uses a third, quieter step for metadata such as hour labels, counts, and a card's
foot line. There is no recessed surface for a field or icon tile set into a card. The radius
scale jumps from the 8 px card to the 4 px inner radius with nothing for a button or chip. The
one shadow is the overlay shadow, too heavy for a card.

## Decision

Add these tokens on the shadow host and map each into the Tailwind theme:

| Token                  | Value                                    | Tailwind utility       |
| ---------------------- | ---------------------------------------- | ---------------------- |
| `--kcp-ink-muted`      | `#6B6B70`                                | `text-ink-muted`       |
| `--kcp-surface-sunken` | `#EFEFF2`                                | `bg-surface-sunken`    |
| `--kcp-radius-sm`      | `6px`                                    | `rounded-kcp-sm`       |
| `--kcp-shadow-soft`    | `0 1px 2px rgba(107, 107, 112, 0.16)`    | `shadow-kcp-soft`      |
| `--kcp-highlight-soft` | `inset 0 1px 0 rgba(255, 255, 255, 0.7)` | none, read by the card |

The tinted card is the `kcp-soft-card` utility. It reads one tint from `--kcp-tint` on the
element, the subject color on an event block, and falls back to the muted ink on a neutral card.
The fill is a gradient of the tint mixed into the surface from `--kcp-tint-strong` (17 percent)
at the top to `--kcp-tint-weak` (8 percent) from 70 percent down. The edge is the tint at
`--kcp-tint-edge` (28 percent), then the white top highlight, then a light shadow of the tint at
`--kcp-tint-shadow` (16 percent). The card is a utility rather than a token because a custom
property declared on the host resolves its `var()` references on the host, so it cannot follow a
tint that each card sets for itself. The card keeps the 8 px card radius.

Because `--kcp-tint` is an inherited custom property, a neutral card nested inside a tinted
element, such as a popover inside an event block subtree, would take the ancestor's tint. Such a
card sets `--kcp-tint: var(--kcp-ink-muted)` itself. Registering the property with
`inherits: false` was rejected because `@property` is ignored inside a shadow root. The redesign
draws a 3 px left accent stripe of the tint on an event block. That stripe belongs to the event
block component and is left out of the utility on purpose, so a neutral card has no stripe.

Neutrals stay cool. The new greys carry a slight blue bias, like the existing `--kcp-surface-alt`
`#F7F7F8`, `--kcp-border` `#E4E4E7`, and `--kcp-border-strong` `#838389`, and the neutral card
shadow is drawn from the muted ink rather than black. No existing token value changes.

Text use is bounded by contrast, and the token contrast suite proves each bound. Ink muted clears
4.5:1 on surface (5.30), surface alt (4.95), surface sunken (4.62), and primary soft (4.68). On a
soft card ink and ink soft may sit anywhere, and are proven on the strong stop for the muted ink
and all ten event palette tints (lowest 4.85 for ink soft). Ink muted is bounded by position
rather than by role: it may sit only where the top edge of its glyphs is at or below 70 percent
of the card height, on the flat weak stop, where it is proven (lowest 4.58). Above that point the
gradient darkens toward the strong stop, where ink muted falls under 4.5:1, and the height at
which it first fails differs per tint, up to 64 percent from the top for berry. A foot line
pinned to the bottom of a short card can rise above the bound, so such a card uses ink soft.

## Alternatives considered

Shifting ink and ink soft to cool greys as well was rejected for this change because every
rendered surface would move at once with nothing in the diff to review it against; the components
adopt cool text as they are restyled. Reusing ink soft for the quiet metadata was rejected because
the redesign needs the step between ink soft and the border to keep the hierarchy readable.
Declaring the tinted card as per subject tokens was rejected because the palette is ten colors and
the hash picks one per block, which a single element tint already expresses. Holding the tokens
until their first consumer, the ADR-0051 rule, was set aside here because the component changes of
the same redesign consume them and need one reviewed set to build on; a token still unused when
that redesign closes is removed.

## Consequences

Component changes use the new utilities instead of literal colors, radii, or shadows, and a
neutral card and an event block share one treatment that differs only in its tint. A card that
places muted text must keep its glyph tops at or below 70 percent of the card height, or use ink
soft instead, and `docs/CONTRAST.md` lists the bound and the per tint limits. A token edit that drops a pair under its bar fails `token-contrast.test.ts`. The fallback
that Tailwind emits for a browser without `color-mix` paints the solid tint, which no supported
browser reaches, since the Tailwind v4 baseline already requires `color-mix`.

## Amendment, 2026-11-21: the neutral card across the catalog

A conformance review of the redesign found the one card treatment stopped at the event blocks,
the query chip, and the suggestion cards. The catalog course cards and their section rows kept
the flat 1 px border, a section row ended in a full height tinted add strip, and the query chip
at the default stops read as a heavy grey pill above white cards. The panel also drew three
different count badges.

- A neutral card that repeats down a list takes the quiet stops: `--kcp-tint-quiet-strong` 4
  percent fading to `--kcp-tint-quiet-weak` 0 percent, with the edge at `--kcp-tint-quiet-edge`
  22 percent, a near white face with a hairline edge, the highlight, and the light shadow. An
  added course card takes the settled stops, 7 percent fading to 5 percent, in place of the flat
  surface-alt fill. The `kcp-soft-quiet` and `kcp-soft-settled` utilities set the card's stop
  names on the element beside `kcp-soft-card`, so the neutral card still shares the one
  treatment and differs only in its stops. Both strong stops sit under the default weak stop, so
  the ink steps, the success, warn, and danger tones, and the primary strong action text each
  clear 4.5:1 anywhere on them, which the contrast suite proves.
- The catalog course card and the query chip take the quiet card. The open sections of a card
  sit on one white band with hairline rules between rows and no edge or shadow of its own, a
  lighter step than the card, rather than a bordered card per row or a card inside the card, so
  an open card keeps one level of nesting as the screen 03 mockup draws it. The query chip's
  pencil tile drops from the sunken well to the lighter surface. The bar keeps its 12 px side
  padding: the 16 px panel gutter wrapped the summary onto another line at 768 and 1366 px,
  and the taller bar left a reopened curriculum form short of its height, which the text fit
  sweep reads as a cut form.
- The filter button, the bottom nav, the header sheet toggle, and the edge rail share one count
  badge: an ink filled pill with white figures and a ring of the surface. It is hidden from
  assistive technology because each control's name carries the count. A count written into a
  label, such as the selected courses tab, stays text and takes no badge.

Alternatives considered: the flat divider rows with no card that the screen 03 mockup drew were
rejected because the owner picked the full soft set for every card. Applying the default stops
to the catalog cards was rejected because a column of them reads as a grey wash, the fault the
review found in the query chip. A brand orange badge was rejected because the orange marks what
can be pressed, and a count is a figure, not a control.

## Amendment, 2026-11-21: ink, ink soft and the overlay shadow turn cool

The conformance review of the redesign found the cool neutrals only half applied: the surfaces,
borders and the new muted ink carry the slight blue bias, but `--kcp-ink` `#1A1A1A` and
`--kcp-ink-soft` `#5C5C5C` stayed pure grey and `--kcp-shadow` stayed black, so text and the
overlay shadow read warmer than the chrome around them. The components of the redesign have now
been restyled, which removes the reason this ADR gave for holding the text tokens back.

Decision. `--kcp-ink` becomes `#1A1B1F`, `--kcp-ink-soft` becomes `#5B5D66`, and `--kcp-shadow`
becomes `0 4px 16px rgba(26, 27, 31, 0.1)`, the same blur and strength drawn from the cool ink.
Everything that mixes the ink, such as the coach mark and tour scrims and the strong grid rule,
follows through `var()`. The token contrast suite now reads ink and ink soft from the stylesheet in
every suite, including the event palette and day colour tests that held copies of the old values,
and it gains the soft notice pairs the text tokens sit on: ink soft on primary soft, warn soft,
danger soft and success soft, and ink on danger soft, success soft and the remove zone. A new cool
neutral check asserts that every neutral, text included, has its blue channel largest and within a
small spread of the others, and that both shadows are drawn from a cool colour, so a later pure grey
or black fails the build.

Every pair still clears its bar. Ink falls by about 0.2 on each surface, to 17.21 on white, and
ink soft by about 0.1, to 6.56 on white and 5.64 on danger soft. On the soft card the lowest ink
soft pair, on the strong stop of berry, moves from 4.85 to 4.76; on the flat poster tint the lowest
moves from 5.05 to 4.95. White on the coach mark scrim over white moves from 8.59 to 8.45.
`docs/CONTRAST.md` lists the new ratios.

A darker ink soft, `#585A63`, was considered to keep the old margins exactly. It was set aside
because it closes the step between ink soft and ink muted that the three step hierarchy relies on,
and the lighter value already clears every bar with room.
