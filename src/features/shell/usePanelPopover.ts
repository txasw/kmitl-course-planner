// One positioning recipe for every panel popover, menu, and hover card. Each floating
// node escapes the panel with a fixed strategy, sits a small gap from its anchor, flips
// to the other side when space runs out, shifts to stay inside the viewport, and is sized
// to the space that remains: its width is capped at min(22rem, available width) and its
// height follows the available height, so a long plan list or a block with many diff rows
// scrolls inside the node instead of running past a short viewport. The node opts into
// that internal scroll by carrying PANEL_POPOVER_SCROLL. The combobox popup keeps its own
// size rule because it matches its input width and caps its list height. While open, a
// node counts as an open surface the student is busy with, unless it is ambient, such as
// a hover card that follows the pointer rather than a choice to open it.
//
// A node may instead stand as a column beside its anchor in a named element, as the block
// detail does in the plan area: it flips and shifts sideways inside that element, its foot
// meets the element's own, and its top meets the foot of the element's head, such as the
// timetable's pinned hour row, or the element's top when it has none. So neither edge of
// the node ever lands part way across a line of the hour row, of the timetable, or of the
// status row under it, however tall the detail grows, and its side edge never meets an hour
// label centred on its gridline. Its body scrolls inside that height, and the column's own
// size is watched, so a status row that wraps onto another line keeps the node's foot above it.

import { useMemo } from 'react';
import { useOpenSurface } from './attentionStore';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Middleware,
  type ReferenceType,
  type FloatingElement,
  type UseFloatingOptions,
  type UseFloatingReturn,
} from '@floating-ui/react';

/** The widest any panel popover may grow, before the available width caps it. */
export const PANEL_POPOVER_MAX_WIDTH = '22rem';

/** The gap kept between a floating node and the viewport edge, in pixels. */
const PANEL_POPOVER_PADDING = 8;

/** Classes that let a size capped floating node scroll inside with the panel scrollbar. */
export const PANEL_POPOVER_SCROLL = 'kcp-scroll overflow-y-auto';

/** The element a node stands in as a column, and the head inside it the node starts below. */
export interface PanelColumn {
  area: Element;
  /** A selector for the head inside the area, read afresh on every placement since the
   * head may be rendered anew; absent or unmatched, the node starts at the area's top. */
  head?: string;
}

/**
 * Stand the node as a column of the area: its top meets the foot of the area's head, or
 * the area's top, and its foot meets the area's, clipped to the viewport. The area is read
 * in viewport terms and moved into the coordinates floating-ui places the node in, through
 * the anchor's offset between the two.
 */
function fillColumn({ area: column, head }: PanelColumn): Middleware {
  return {
    name: 'fillColumn',
    fn({ elements, rects, y }) {
      const area = column.getBoundingClientRect();
      const headNode = head === undefined ? null : column.querySelector(head);
      const headFoot = headNode?.getBoundingClientRect().bottom ?? area.top;
      const top = Math.max(0, area.top, headFoot);
      const foot = Math.min(document.documentElement.clientHeight, area.bottom);
      const height = `${String(Math.max(0, foot - top))}px`;
      Object.assign(elements.floating.style, { height, maxHeight: height });
      const toPlaced =
        rects.reference.y - elements.reference.getBoundingClientRect().top;
      return { y: Number.isFinite(toPlaced) ? top + toPlaced : y };
    },
  };
}

/** Keep a column node placed as the page moves, and as the column itself resizes, which
 * the anchor and the node alone do not show: a status row that wraps onto another line
 * shortens the plan area without moving or resizing the block. */
function watchColumn(column: PanelColumn) {
  return (
    reference: ReferenceType,
    floating: FloatingElement,
    update: () => void,
  ): (() => void) => {
    const stop = autoUpdate(reference, floating, update);
    const observer = new ResizeObserver(update);
    observer.observe(column.area);
    return () => {
      stop();
      observer.disconnect();
    };
  };
}

export function panelPopoverMiddleware(
  gap: number,
  column: PanelColumn | null = null,
): Middleware[] {
  const padding = PANEL_POPOVER_PADDING;
  const width = (available: number) =>
    `min(${PANEL_POPOVER_MAX_WIDTH}, ${String(Math.max(0, available))}px)`;
  if (column !== null) {
    // Only the side is chosen and kept in: the column middleware sets the block axis.
    const inside = { padding, boundary: column.area };
    return [
      offset(gap),
      flip({ ...inside, crossAxis: false }),
      shift({ ...inside, mainAxis: false, crossAxis: true }),
      size({
        ...inside,
        apply({ availableWidth, elements }) {
          elements.floating.style.maxWidth = width(availableWidth);
        },
      }),
      fillColumn(column),
    ];
  }
  return [
    offset(gap),
    flip({ padding }),
    shift({ padding }),
    size({
      padding,
      apply({ availableWidth, availableHeight, elements }) {
        Object.assign(elements.floating.style, {
          maxWidth: width(availableWidth),
          maxHeight: `${String(Math.max(0, availableHeight))}px`,
        });
      },
    }),
  ];
}

export interface PanelPopoverOptions extends Omit<
  UseFloatingOptions,
  'middleware' | 'strategy' | 'whileElementsMounted'
> {
  /** The distance from the anchor to the floating node, in pixels. */
  gap: number;
  /** Whether the node opens by itself, as a hover card does, so it never counts as an
   * open surface that holds the student's attention. */
  ambient?: boolean;
  /** The element the node stands in as a column beside its anchor, below its head. */
  column?: PanelColumn | null;
}

export function usePanelPopover<RT extends ReferenceType = ReferenceType>({
  gap,
  ambient = false,
  column = null,
  ...options
}: PanelPopoverOptions): UseFloatingReturn<RT> {
  const middleware = useMemo(
    () => panelPopoverMiddleware(gap, column),
    [gap, column],
  );
  const whileElementsMounted = useMemo(
    () => (column === null ? autoUpdate : watchColumn(column)),
    [column],
  );
  useOpenSurface(options.open === true && !ambient);
  return useFloating<RT>({
    ...options,
    strategy: 'fixed',
    middleware,
    whileElementsMounted,
  });
}
