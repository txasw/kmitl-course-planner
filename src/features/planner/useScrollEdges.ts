// Tracks which sides of a scroller still hide content, for the edge fade that tells the
// student the grid continues past the column. It listens to the scroller's own scroll and to
// resizes of the scroller and its content, since a wider window or a narrower column changes
// the overflow with no scroll. An unchanged reading keeps the same object, so a scroll that
// moves within the middle of the content does not re-render the consumer.

import { useEffect, useState, type RefObject } from 'react';

export interface ScrollEdges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  /** The width of a vertical scrollbar, so a trailing fade sits inside it. */
  scrollbarX: number;
  /** The height of a horizontal scrollbar, so a bottom fade sits above it. */
  scrollbarY: number;
}

export interface ScrollMetrics {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  offsetHeight: number;
}

// Fractional scroll offsets at a zoom level leave a sub pixel remainder at either end, which
// is not hidden content.
const SLACK_PX = 1;

const NO_EDGES: ScrollEdges = {
  left: false,
  right: false,
  top: false,
  bottom: false,
  scrollbarX: 0,
  scrollbarY: 0,
};

export function scrollEdges(metrics: ScrollMetrics): ScrollEdges {
  const hiddenRight =
    metrics.scrollWidth - metrics.clientWidth - metrics.scrollLeft;
  const hiddenBottom =
    metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
  return {
    left: metrics.scrollLeft > SLACK_PX,
    right: hiddenRight > SLACK_PX,
    top: metrics.scrollTop > SLACK_PX,
    bottom: hiddenBottom > SLACK_PX,
    scrollbarX: Math.max(0, metrics.offsetWidth - metrics.clientWidth),
    scrollbarY: Math.max(0, metrics.offsetHeight - metrics.clientHeight),
  };
}

function sameEdges(a: ScrollEdges, b: ScrollEdges): boolean {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.scrollbarX === b.scrollbarX &&
    a.scrollbarY === b.scrollbarY
  );
}

export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES);

  useEffect(() => {
    const node = ref.current;
    if (node === null) {
      return undefined;
    }
    const measure = () => {
      const next = scrollEdges(node);
      setEdges((previous) => (sameEdges(previous, next) ? previous : next));
    };
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild !== null) {
      observer.observe(node.firstElementChild);
    }
    return () => {
      node.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [ref]);

  return edges;
}
