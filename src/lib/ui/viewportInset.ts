// How far the visible part of the page sits inside the layout viewport. A phone browser
// that opens its on screen keyboard shrinks the visual viewport only, so a fixed layer
// pinned to the layout viewport keeps its full height and its foot lies under the
// keyboard. The inset is the band above and below the visual viewport, so a fixed layer
// that takes it as its top and bottom fits the part of the screen the keyboard leaves.
//
// The band a fixed layer resolves against is measured from a layer that fills it, not
// read from documentElement.clientHeight. On a phone that height is the initial
// containing block, sized with the browser toolbar shown, while a fixed layer follows the
// layout viewport, which grows by the toolbar height whenever the browser hides its
// toolbar, so an inset taken from it would leave the foot of the layer that far under the
// keyboard.
//
// A pinch zoom also shrinks the visual viewport, but there the student pans around a
// magnified page on purpose, so a zoomed viewport reports no inset and the layer keeps
// its layout. Each side is floored to whole pixels and never negative, because a desktop
// browser at a fractional zoom reports a visual viewport a fraction of a pixel off the
// layout one, which must not move a layer.

/** The custom property that carries the top inset to the fixed layers of the panel. */
export const VIEWPORT_TOP_PROPERTY = '--kcp-viewport-top';

/** The custom property that carries the bottom inset to the fixed layers of the panel. */
export const VIEWPORT_BOTTOM_PROPERTY = '--kcp-viewport-bottom';

/**
 * The placement of a fixed layer that fills the visible part of the viewport, in place
 * of inset-0. Without the properties set it is the full viewport, as inset-0 is.
 */
export const VIEWPORT_FIT =
  'inset-x-0 top-[var(--kcp-viewport-top,0px)] bottom-[var(--kcp-viewport-bottom,0px)]';

export interface ViewportInset {
  top: number;
  bottom: number;
}

/** The top and bottom edges of the box a fixed layer resolves against, in client pixels. */
export interface LayoutBand {
  top: number;
  bottom: number;
}

/** The visual viewport fields the inset reads, as window.visualViewport reports them. */
export interface VisualViewportBox {
  offsetTop: number;
  height: number;
  scale: number;
}

export const NO_INSET: ViewportInset = { top: 0, bottom: 0 };

// How far the scale may sit from 1 and still count as unzoomed.
const SCALE_TOLERANCE = 0.01;

export function viewportInset(
  layout: LayoutBand,
  viewport: VisualViewportBox,
): ViewportInset {
  if (Math.abs(viewport.scale - 1) > SCALE_TOLERANCE) {
    return NO_INSET;
  }
  const top = Math.max(0, Math.floor(viewport.offsetTop - layout.top));
  const bottom = Math.max(
    0,
    Math.floor(layout.bottom - viewport.offsetTop - viewport.height),
  );
  return top === 0 && bottom === 0 ? NO_INSET : { top, bottom };
}

/**
 * The band behind a fixed layer that takes the inset, from its client rect and the inset
 * it currently carries: the layer sits that far inside the band on each side.
 */
export function bandBehind(
  rect: LayoutBand,
  applied: ViewportInset,
): LayoutBand {
  return { top: rect.top - applied.top, bottom: rect.bottom + applied.bottom };
}

export function sameInset(a: ViewportInset, b: ViewportInset): boolean {
  return a.top === b.top && a.bottom === b.bottom;
}

/** The four edges of the box a fixed layer resolves against, in client pixels. */
export interface LayoutBox extends LayoutBand {
  left: number;
  right: number;
}

/** The visual viewport fields the four sided inset reads. */
export interface VisualViewportRect extends VisualViewportBox {
  offsetLeft: number;
  width: number;
}

/** How far the visible part of the page sits inside the layout viewport on each side. */
export interface ViewportEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_EDGES: ViewportEdges = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The band on each side of the visual viewport inside the layout viewport. A phone browser
 * grows the layout viewport past the screen when a page is wider than the screen, and a
 * fixed layer pinned to its bottom right corner then sits off screen; a layer that adds
 * these edges to its offsets stays in the part of the page on screen. A pinch zoom reports
 * none, as for the top and bottom inset.
 */
export function visibleEdges(
  layout: LayoutBox,
  viewport: VisualViewportRect,
): ViewportEdges {
  if (Math.abs(viewport.scale - 1) > SCALE_TOLERANCE) {
    return NO_EDGES;
  }
  const { top, bottom } = viewportInset(layout, viewport);
  const left = Math.max(0, Math.floor(viewport.offsetLeft - layout.left));
  const right = Math.max(
    0,
    Math.floor(layout.right - viewport.offsetLeft - viewport.width),
  );
  return top === 0 && right === 0 && bottom === 0 && left === 0
    ? NO_EDGES
    : { top, right, bottom, left };
}
