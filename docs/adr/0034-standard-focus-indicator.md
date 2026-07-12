# 34. Standard keyboard focus indicator

Status: Accepted
Date: 2026-07-12

## Context

Two focus indicator patterns had grown side by side. One was a Tailwind ring,
`focus:ring-2 focus:ring-primary focus:outline-none`, a box-shadow that fires on
pointer focus as well as keyboard focus and draws outside the border box. The other
was a native outline, `focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-primary`, which fires only on keyboard focus but also draws
outside the border box. Both draw outward, so a control that sits flush inside a
clipping ancestor has its indicator truncated: the full width search selects and the
subject id input inside the scrolling search rail, and any control inside the slide
over catalog drawer whose `translate-x` establishes a clipping context, showed a focus
ring cut off on its sides. Post release manual QA reported the clipped ring.

## Decision

One focus token, the brand orange on `:focus-visible` only, kept as two string
constants in `src/lib/ui/focus.ts` so the classes are captured once rather than repeated
by hand.

`FOCUS_RING` is the default for light and bordered controls. It is an inset ring
(`focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary`), so it
paints inside the border box and a clipping overflow ancestor cannot truncate it, and
because it is the Tailwind ring utility it composes with the shadow utilities through
the same box-shadow chain, so an elevated control such as the selected search tab keeps
its shadow.

`FOCUS_OUTLINE` (`focus-visible:outline-2 focus-visible:outline-offset-2
focus-visible:outline-primary`) is for solid primary-strong filled controls only, such
as the submit button, the retry buttons, and the active day chip. An inset orange ring
on an orange fill is about 1.2:1, under the 3:1 UI bar, so those keep an offset outline
that sits on the surrounding surface, where the brand orange clears the 3:1 accent bar
already asserted by the token contrast test.

The brand orange at the 3:1 UI bar needs no new token; the existing `--kcp-primary`
carries the ring and outline.

## Alternatives considered

An inset outline, `outline-offset: -2px`, also escapes the clip, but it is a second
mechanism that does not compose with the ring and shadow chain, so an elevated control
would need special handling. A hand written focus class in the shadow stylesheet was
rejected because a raw box-shadow declaration would override the shadow utility that
elevates the tab and the popovers. Converting the solid filled buttons to the inset ring
was rejected because the orange on orange ring fails the 3:1 bar.

## Consequences

`FOCUS_RING` and `FOCUS_OUTLINE` are the go forward standard; new controls import them
rather than writing focus classes. The debug only diagnostics controls were left on the
old pattern because they never ship. The remaining offset outline controls that already
sit outside any clipping context are visually equivalent and migrate opportunistically.
