// How far the visible part of the page sits inside the layout viewport. A phone browser
// that opens its on screen keyboard shrinks the visual viewport only, so a fixed layer
// pinned to the layout viewport keeps its full height and its foot lies under the
// keyboard. The inset is the band above and below the visual viewport, so a fixed layer
// that takes it as its top and bottom fits the part of the screen the keyboard leaves.
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
  layoutHeight: number,
  viewport: VisualViewportBox,
): ViewportInset {
  if (Math.abs(viewport.scale - 1) > SCALE_TOLERANCE) {
    return NO_INSET;
  }
  const top = Math.max(0, Math.floor(viewport.offsetTop));
  const bottom = Math.max(
    0,
    Math.floor(layoutHeight - viewport.offsetTop - viewport.height),
  );
  return top === 0 && bottom === 0 ? NO_INSET : { top, bottom };
}

export function sameInset(a: ViewportInset, b: ViewportInset): boolean {
  return a.top === b.top && a.bottom === b.bottom;
}
