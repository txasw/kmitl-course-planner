// Keeps the helper card, the launcher, and the toast region on the part of the page the
// screen shows. A phone browser lays a fixed layer out against the layout viewport, which
// it grows past the screen when the page is wider than the screen, so a layer pinned to
// the bottom right corner sits off screen with only its edge peeking in. While a helper
// page is open this follows window.visualViewport and sets the band on each side of the
// screen as custom properties on the app root, which those layers add to their offsets.
// The layout viewport is measured from an invisible fixed layer that fills it, and its
// size is watched too, since a page that grows wider grows it without moving the screen.
// A desktop browser, whose visual viewport matches the layout one, and a pinch zoom set
// none.

import { useLayoutEffect, useRef } from 'react';
import {
  NO_EDGES,
  visibleEdges,
  type ViewportEdges,
} from '@/lib/ui/viewportInset';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** The custom property that carries one side's band to the helper's fixed layers. */
export function visibleProperty(side: (typeof SIDES)[number] | 'height') {
  return `--kcp-visible-${side}`;
}

function same(a: ViewportEdges, b: ViewportEdges): boolean {
  return SIDES.every((side) => a[side] === b[side]);
}

function write(node: HTMLElement, edges: ViewportEdges, height: number) {
  for (const side of SIDES) {
    node.style.setProperty(visibleProperty(side), `${String(edges[side])}px`);
  }
  node.style.setProperty(visibleProperty('height'), `${String(height)}px`);
}

function clear(node: HTMLElement) {
  for (const side of [...SIDES, 'height'] as const) {
    node.style.removeProperty(visibleProperty(side));
  }
}

export function HelperViewport() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const probe = ref.current;
    const target = probe?.parentElement ?? null;
    const viewport = window.visualViewport ?? null;
    if (probe === null || target === null || viewport === null) {
      return undefined;
    }
    let applied = NO_EDGES;
    const update = () => {
      const layout = probe.getBoundingClientRect();
      const next = visibleEdges(layout, viewport);
      if (same(next, applied)) return;
      applied = next;
      if (next === NO_EDGES) {
        clear(target);
        return;
      }
      write(
        target,
        next,
        Math.floor(layout.bottom - layout.top - next.top - next.bottom),
      );
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(probe);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      observer?.disconnect();
      clear(target);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none invisible fixed inset-0"
    />
  );
}
