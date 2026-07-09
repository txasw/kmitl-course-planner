import { describe, expect, it } from 'vitest';
import { orderByPriority } from './collision';
import { REMOVE_ZONE_ID } from './RemoveZone';

describe('orderByPriority', () => {
  it('orders remove over swap over candidate over panel', () => {
    const ordered = orderByPriority([
      { id: 'kcp-planner-drop' },
      { id: 'cand-a' },
      { id: 'swap-b' },
      { id: REMOVE_ZONE_ID },
    ]);
    expect(ordered.map((collision) => collision.id)).toEqual([
      REMOVE_ZONE_ID,
      'swap-b',
      'cand-a',
      'kcp-planner-drop',
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
