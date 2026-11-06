// Where focus lands after a placed section leaves the edit grid. The control that removed
// it, a block's remove button, its popover, or its context menu, goes with it, so focus
// moves on to the next placed item in time order: the blocks by day and start, then the
// unscheduled shelf rows in their listed order. When the removed section came last, the
// last item left takes focus, and when none is left the grid itself does. Items are read
// from the DOM before and after the commit, by the data attributes the grid and the shelf
// render, so the order is the one on screen.

import type { Meeting } from '@/lib/domain/types';

const DAY_MINUTES = 24 * 60;

// Shelf rows have no time, so they order after every meeting of the week.
const SHELF_BASE = 7 * DAY_MINUTES;

/** A meeting's place in the week, Sunday first like the grid rows. */
export function meetingOrder(
  meeting: Pick<Meeting, 'day' | 'startMin'>,
): number {
  return meeting.day * DAY_MINUTES + meeting.startMin;
}

interface PlacedItem {
  element: HTMLElement;
  teachTableId: string | undefined;
  order: number;
}

function placedItems(scope: ParentNode): PlacedItem[] {
  const blocks = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-block-order]'),
    (element) => ({
      element,
      teachTableId: element.dataset.teachTableId,
      order: Number(element.dataset.blockOrder),
    }),
  ).sort((a, b) => a.order - b.order);
  const shelf = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-shelf-remove]'),
    (element, index) => ({
      element,
      teachTableId: element.dataset.shelfRemove,
      order: SHELF_BASE + index,
    }),
  );
  return [...blocks, ...shelf];
}

/**
 * The place in time order of the section about to be removed: its earliest block, or its
 * shelf row. Read before the commit, while the section still shows. Null when it shows
 * nowhere.
 */
export function removalOrder(
  scope: ParentNode,
  teachTableId: string,
): number | null {
  const orders = placedItems(scope)
    .filter((item) => item.teachTableId === teachTableId)
    .map((item) => item.order);
  return orders.length === 0 ? null : Math.min(...orders);
}

/**
 * The focus targets after a removal, best first: the first placed item at or after the
 * removed section's place, then the last item left, then the grid. Read after the commit.
 */
export function targetsAfterRemoval(
  scope: ParentNode,
  removed: number | null,
): (HTMLElement | null | undefined)[] {
  const items = placedItems(scope);
  const next =
    removed === null ? undefined : items.find((item) => item.order >= removed);
  return [
    next?.element,
    items[items.length - 1]?.element,
    scope.querySelector<HTMLElement>('[data-edit-grid]'),
  ];
}
