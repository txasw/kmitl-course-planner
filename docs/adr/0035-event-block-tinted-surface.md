# 35. Event block tinted surface and ink text

Status: Accepted
Date: 2026-07-12

Amends ADR-0023.

## Context

Post release UX review found the grid blocks read too flat and heavy: a solid saturated fill
with white text is a strong block of color that dominates the light panel and makes a dense
week look busy. ADR-0023 chose the ten color palette and the white on solid fill and proved
each color clears WCAG AA against white text. The palette, its deterministic hash, its
exclusion of the KMITL orange, and its minimum perceptual distance are all still sound. What
reads poorly is the fill and text treatment, not the color choice.

## Decision

Keep the ADR-0023 palette and hash unchanged. Change the block treatment: the fill is the
subject color composited over white at a shared 15 percent alpha, a soft tint; the text is
ink rather than white; and the saturated subject color moves to a solid left bar that carries
the identity. The revalidation danger inset ring and the hatch overlay stay, since they are a
strong signal that must read on the lighter fill; the hover controls move from a translucent
black chip with white text to a translucent ink chip with ink text.

The 15 percent alpha is composited to a concrete opaque hex in `hashTint`, not left as a
runtime alpha, so html-to-image inlines a stable fill and the exported image and the preview
render identically to edit. The value is a shared constant, `EVENT_TINT_ALPHA`, imported by
the contrast test so the value that ships is the value that is proven.

The contrast guarantee changes axis from ADR-0023's white on solid to two new pairs, both
enforced by `hash-color.test.ts`: ink on each composited tint clears the 4.5:1 text bar (every
color clears it near 13.5 to 14.3 to 1), and the solid left bar clears the 3:1 UI bar against
its own tint. `docs/CONTRAST.md` records the shipped values.

## Alternatives considered

A runtime alpha through a `color-mix` or an rgba fill was rejected because a concrete hex is
the surest way to keep the export identical to the screen, and the composite is trivial to
memoize per subject. Darkening the palette instead of tinting was rejected because it does not
address the heaviness of a full saturated fill. Keeping white text on a lighter tint was
rejected because white on a 15 percent tint fails contrast badly; the tint demands ink text.

## Consequences

Blocks read as a light tinted surface with a colored spine and dark text, quieter at density
while keeping the subject identity through the bar and the hue. The palette and its tests from
ADR-0023 stand; only the usage and its enforced pairs change, which is why this amends rather
than replaces that record. A future change to the alpha or the palette must update the shared
constant and the enforced pairs together.
