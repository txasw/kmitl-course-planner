import { describe, expect, it } from 'vitest';
import type { ClientRect, DroppableContainer } from '@dnd-kit/core';
import { orderByPriority, prioritizedCollision } from './collision';
import { REMOVE_ZONE_ID } from './RemoveZone';

const PANEL_ID = 'kcp-planner-drop';
const CATALOG_REMOVE_ID = 'kcp-remove-catalog';
const BAR_REMOVE_ID = 'kcp-remove-bar';

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } satisfies ClientRect;
}

function droppable(id: string): DroppableContainer {
  return {
    id,
    key: id,
    data: { current: undefined },
    disabled: false,
    node: { current: null },
    rect: { current: null },
  };
}

/**
 * Resolve a drop at a point the way the drag context does: dnd-kit hands the detection
 * only the droppables that are mounted and enabled, each with its measured rect.
 */
function hitsAt(
  point: { x: number; y: number },
  targets: { id: string; rect: ClientRect }[],
): (string | number)[] {
  return prioritizedCollision({
    active: {
      id: 'block-a',
      data: { current: undefined },
      rect: { current: { initial: null, translated: null } },
    },
    collisionRect: rect(point.x, point.y, 1, 1),
    droppableRects: new Map(targets.map((target) => [target.id, target.rect])),
    droppableContainers: targets.map((target) => droppable(target.id)),
    pointerCoordinates: point,
  }).map((collision) => collision.id);
}

describe('orderByPriority', () => {
  it('orders remove over swap over candidate over panel', () => {
    const ordered = orderByPriority([
      { id: PANEL_ID },
      { id: 'cand-a' },
      { id: 'swap-b' },
      { id: REMOVE_ZONE_ID },
    ]);
    expect(ordered.map((collision) => collision.id)).toEqual([
      REMOVE_ZONE_ID,
      'swap-b',
      'cand-a',
      PANEL_ID,
    ]);
  });

  it.each([CATALOG_REMOVE_ID, BAR_REMOVE_ID])(
    'ranks the remove prefixed %s above a swap target and a candidate',
    (removeId) => {
      const ordered = orderByPriority([
        { id: 'swap-b' },
        { id: 'cand-a' },
        { id: removeId },
      ]);
      expect(ordered.map((collision) => collision.id)).toEqual([
        removeId,
        'swap-b',
        'cand-a',
      ]);
    },
  );

  it('ranks a lifted origin below a candidate and above the panel', () => {
    const ordered = orderByPriority([
      { id: PANEL_ID },
      { id: 'origin-a-1-540' },
      { id: 'cand-b' },
    ]);
    expect(ordered.map((collision) => collision.id)).toEqual([
      'cand-b',
      'origin-a-1-540',
      PANEL_ID,
    ]);
  });

  it('keeps the pointer order among equal priority targets', () => {
    const ordered = orderByPriority([
      { id: 'cand-first' },
      { id: 'cand-second' },
    ]);
    expect(ordered.map((collision) => collision.id)).toEqual([
      'cand-first',
      'cand-second',
    ]);
  });

  it('returns a single collision unchanged', () => {
    const collisions = [{ id: 'cand-only' }];
    expect(orderByPriority(collisions)).toBe(collisions);
  });
});

describe('prioritizedCollision', () => {
  // The docked column at the panel's leading edge, and the planner drop zone, which the
  // hidden column overlaps once it leaves the flow and the grid takes the full width.
  const column = rect(0, 0, 384, 800);
  const panel = rect(0, 0, 1440, 800);
  const overColumn = { x: 192, y: 400 };

  it('resolves a drop over the shown column to the catalog remove zone', () => {
    expect(
      hitsAt(overColumn, [
        { id: PANEL_ID, rect: panel },
        { id: CATALOG_REMOVE_ID, rect: column },
      ]),
    ).toEqual([CATALOG_REMOVE_ID, PANEL_ID]);
  });

  it('resolves a drop over the hidden column to the panel, never a remove zone', () => {
    // The hidden column mounts no remove zone, so although its box still holds the
    // pointer, only the panel and the bar at the panel bottom are targets.
    expect(
      hitsAt(overColumn, [
        { id: PANEL_ID, rect: panel },
        { id: BAR_REMOVE_ID, rect: rect(0, 736, 1440, 64) },
      ]),
    ).toEqual([PANEL_ID]);
  });
});
