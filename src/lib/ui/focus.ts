// The standard keyboard focus indicator, recorded in ADR-0034. One color, the brand
// orange, on :focus-visible only. Its color, width, and offset come from the
// --kcp-focus-* tokens on the shadow host, so the indicator changes in one place.
//
// FOCUS_RING is the default for light and bordered controls. It is an inset ring, so it
// paints inside the border box and a clipping overflow ancestor (the scrolling search
// rail, the translate-x catalog drawer) can never truncate it, and it composes with
// shadow utilities so an elevated control keeps its shadow. FOCUS_OUTLINE is for solid
// primary-strong filled controls only: an inset orange ring on an orange fill is about
// 1.2:1, under the 3:1 UI bar, so those keep an offset outline that sits on the
// surrounding surface at the accepted 3:1 accent ratio.

export const FOCUS_RING =
  'outline-none focus-visible:ring-(length:--kcp-focus-width) focus-visible:ring-inset focus-visible:ring-(color:--kcp-focus-color)';

export const FOCUS_OUTLINE =
  'outline-none focus-visible:outline-(length:--kcp-focus-width) focus-visible:outline-offset-(--kcp-focus-offset) focus-visible:outline-(color:--kcp-focus-color)';
