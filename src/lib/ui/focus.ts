// The standard keyboard focus indicator, recorded in ADR-0034. One token, the brand
// orange, on :focus-visible only.
//
// FOCUS_RING is the default for light and bordered controls. It is an inset ring, so it
// paints inside the border box and a clipping overflow ancestor (the scrolling search
// rail, the translate-x catalog drawer) can never truncate it, and it composes with
// shadow utilities so an elevated control keeps its shadow. FOCUS_OUTLINE is for solid
// primary-strong filled controls only: an inset orange ring on an orange fill is about
// 1.2:1, under the 3:1 UI bar, so those keep an offset outline that sits on the
// surrounding surface at the accepted 3:1 accent ratio.

export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

export const FOCUS_OUTLINE =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
