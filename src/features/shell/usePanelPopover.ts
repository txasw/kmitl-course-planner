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
  type UseFloatingOptions,
  type UseFloatingReturn,
} from '@floating-ui/react';

/** The widest any panel popover may grow, before the available width caps it. */
export const PANEL_POPOVER_MAX_WIDTH = '22rem';

/** The gap kept between a floating node and the viewport edge, in pixels. */
const PANEL_POPOVER_PADDING = 8;

/** Classes that let a size capped floating node scroll inside with the panel scrollbar. */
export const PANEL_POPOVER_SCROLL = 'kcp-scroll overflow-y-auto';

export function panelPopoverMiddleware(gap: number): Middleware[] {
  return [
    offset(gap),
    flip({ padding: PANEL_POPOVER_PADDING }),
    shift({ padding: PANEL_POPOVER_PADDING }),
    size({
      padding: PANEL_POPOVER_PADDING,
      apply({ availableWidth, availableHeight, elements }) {
        Object.assign(elements.floating.style, {
          maxWidth: `min(${PANEL_POPOVER_MAX_WIDTH}, ${String(Math.max(0, availableWidth))}px)`,
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
}

export function usePanelPopover<RT extends ReferenceType = ReferenceType>({
  gap,
  ambient = false,
  ...options
}: PanelPopoverOptions): UseFloatingReturn<RT> {
  const middleware = useMemo(() => panelPopoverMiddleware(gap), [gap]);
  useOpenSurface(options.open === true && !ambient);
  return useFloating<RT>({
    ...options,
    strategy: 'fixed',
    middleware,
    whileElementsMounted: autoUpdate,
  });
}
