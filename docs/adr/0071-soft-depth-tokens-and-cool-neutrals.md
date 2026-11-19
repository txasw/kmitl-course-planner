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
scale jumps from the 8 px card to the 4 px inner radius with nothing for a button, chip, or event
block. The one shadow is the overlay shadow, too heavy for a card.

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
tint that each card sets for itself.

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
