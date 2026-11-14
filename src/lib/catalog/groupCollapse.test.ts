import { describe, expect, it } from 'vitest';
import {
  EMPTY_GROUP_COLLAPSE,
  isGroupCollapsed,
  withGroupCollapsed,
} from './groupCollapse';

describe('group collapse', () => {
  it('starts with every heading expanded', () => {
    expect(isGroupCollapsed(EMPTY_GROUP_COLLAPSE, 'q1', 'g1')).toBe(false);
  });

  it('collapses and expands one heading for its query', () => {
    const collapsed = withGroupCollapsed(
      EMPTY_GROUP_COLLAPSE,
      'q1',
      'g1',
      true,
    );
    expect(isGroupCollapsed(collapsed, 'q1', 'g1')).toBe(true);
    expect(isGroupCollapsed(collapsed, 'q1', 'g2')).toBe(false);
    const expanded = withGroupCollapsed(collapsed, 'q1', 'g1', false);
    expect(isGroupCollapsed(expanded, 'q1', 'g1')).toBe(false);
  });

  it('does not repeat a heading collapsed twice', () => {
    const once = withGroupCollapsed(EMPTY_GROUP_COLLAPSE, 'q1', 'g1', true);
    expect(withGroupCollapsed(once, 'q1', 'g1', true).collapsed).toEqual([
      'g1',
    ]);
  });

  it('starts clean for a new query', () => {
    const first = withGroupCollapsed(EMPTY_GROUP_COLLAPSE, 'q1', 'g1', true);
    expect(isGroupCollapsed(first, 'q2', 'g1')).toBe(false);
    const second = withGroupCollapsed(first, 'q2', 'g2', true);
    expect(second).toEqual({ queryKey: 'q2', collapsed: ['g2'] });
  });
});
