// The edit grid scroller. A broad result can widen the grid past its column, and the sticky
// axes keep the day and the hour in view as it scrolls; a 16 px fade on each side that still
// hides content tells the student the grid continues there (ADR-0050). The leading fades
// start past the sticky axes so they never wash out a day or hour label, and the trailing
// fades sit inside any scrollbar. The fades are decoration over the content, so they are
// aria hidden and take no pointer input. The component mounts with the edit grid, so the
// scroll listener always observes the live scroller node.

import { useRef, type ReactNode } from 'react';
import { EDIT_DAY_AXIS_PX } from '@/lib/planner/grid';
import { AXIS_TRACK_EM, EDIT_FONT_PX } from './gridGeometry';
import { useScrollEdges } from './useScrollEdges';

const FADE =
  'pointer-events-none absolute z-sticky from-surface to-transparent';
// Each axis draws a 1 px rule on its trailing edge, and a leading fade starts just past it
// so the rule stays crisp.
const FADE_START_X = EDIT_DAY_AXIS_PX + 1;
const FADE_START_Y = AXIS_TRACK_EM * EDIT_FONT_PX + 1;

interface GridScrollerProps {
  children: ReactNode;
}

export function GridScroller({ children }: GridScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scrollerRef);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        className="relative min-h-0 flex-1 overflow-auto kcp-scroll"
      >
        {children}
      </div>
      {edges.left ? (
        <div
          aria-hidden
          data-edge-fade="left"
          className={`${FADE} top-0 w-4 bg-linear-to-r`}
          style={{ left: FADE_START_X, bottom: edges.scrollbarY }}
        />
      ) : null}
      {edges.right ? (
        <div
          aria-hidden
          data-edge-fade="right"
          className={`${FADE} top-0 w-4 bg-linear-to-l`}
          style={{ right: edges.scrollbarX, bottom: edges.scrollbarY }}
        />
      ) : null}
      {edges.top ? (
        <div
          aria-hidden
          data-edge-fade="top"
          className={`${FADE} h-4 bg-linear-to-b`}
          style={{
            top: FADE_START_Y,
            left: FADE_START_X,
            right: edges.scrollbarX,
          }}
        />
      ) : null}
      {edges.bottom ? (
        <div
          aria-hidden
          data-edge-fade="bottom"
          className={`${FADE} left-0 h-4 bg-linear-to-t`}
          style={{ bottom: edges.scrollbarY, right: edges.scrollbarX }}
        />
      ) : null}
    </div>
  );
}
