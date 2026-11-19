// The edit grid scroller. A broad result can widen the grid past its column, and the sticky
// axes keep the day and the hour in view as it scrolls; a 16 px fade on each side that still
// hides content tells the student the grid continues there (ADR-0050). The leading fades
// start past the sticky axes so they never wash out a day or hour label, and the trailing
// fades sit inside any scrollbar. The fades are decoration over the content, so they are
// aria hidden and take no pointer input. The component mounts with the edit grid, so the
// scroll listener always observes the live scroller node.
//
// The scroller also sets the edit grid font: it measures its own width and hands the
// stepped size to its content, so a wide panel or a hidden catalog reads at a larger size.
// It measures the outer region rather than the scroll box, so a scrollbar that appears or
// goes as the type steps cannot change the width that chose the step.
//
// The day view also asks the scroller to open each day on its first class. Its grid runs
// from the window start, so on a phone a day whose classes begin after noon would otherwise
// open on empty morning rows. Each time the reveal key changes, and when the measured font
// steps, the scroller lifts its earliest block to just under the sticky header; a later
// manual scroll on the same day is left alone.

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { revealScrollTop } from '@/lib/planner/dayView';
import { EDIT_DAY_AXIS_PX } from '@/lib/planner/grid';
import { gridFontPx } from '@/lib/ui/breakpoints';
import { useElementSize } from '@/features/shell/useElementSize';
import { AXIS_TRACK_EM } from './gridGeometry';
import { useScrollEdges } from './useScrollEdges';

const FADE =
  'pointer-events-none absolute z-sticky from-surface to-transparent';
// Each axis draws a 1 px rule on its trailing edge, and a leading fade starts just past it
// so the rule stays crisp. The hour axis height follows the grid font.
const FADE_START_X = EDIT_DAY_AXIS_PX + 1;

interface GridScrollerProps {
  /** Renders the scroller content at the edit grid font size for the measured width. */
  children: (fontPx: number) => ReactNode;
  /** Changes when the content should open on its earliest block, as on a new day. */
  revealKey?: string | number;
}

/** The tops of the placed blocks, measured from the top of the scrolled content. */
function blockTops(scroller: HTMLElement): number[] {
  const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
  return Array.from(
    scroller.querySelectorAll<HTMLElement>('[data-block-order]'),
    (block) => block.getBoundingClientRect().top - origin,
  );
}

export function GridScroller({ children, revealKey }: GridScrollerProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scrollerRef);
  const fontPx = gridFontPx(useElementSize(regionRef).width);
  const fadeStartY = AXIS_TRACK_EM * fontPx + 1;

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (revealKey === undefined || scroller === null) {
      return;
    }
    // The margin of one grid em keeps the block's hour label clear of the header.
    scroller.scrollTop = revealScrollTop(
      blockTops(scroller),
      AXIS_TRACK_EM * fontPx,
      fontPx,
    );
  }, [revealKey, fontPx]);

  return (
    <div ref={regionRef} className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        className="relative min-h-0 flex-1 overflow-auto kcp-scroll"
      >
        {children(fontPx)}
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
            top: fadeStartY,
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
