// The time rules of the weekly grid, drawn once across every day track rather than per day
// row. One grid item per hour carries the hour rule, stronger at the window start, midday,
// and end, and one item per remaining quarter carries the fainter quarter rule. A per row
// gradient rounded its percentage stops differently in each row, and differently from the
// grid tracks, under the poster scale, so rows showed stray or doubled rules and dropped
// quarter lines. A rule that is a grid item lands on the same track line as the blocks in
// every row. Edit and the poster draw the same rules. Renders a fragment so every item is a
// direct child of the grid, after the lanes so the rules paint over the alternating row fill
// and under the positioned blocks.

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { hourRules, quarterCount, type GridWindow } from '@/lib/planner/grid';
import {
  FIRST_DAY_INDEX,
  FIRST_TIME_INDEX,
  QUARTERS_PER_HOUR,
  type Orientation,
} from './gridGeometry';

type RuleWeight = 'strong' | 'hour' | 'quarter';

interface Rule {
  /** The quarter offset of the rule from the window start. */
  offset: number;
  weight: RuleWeight;
}

const RULE_COLOR: Record<RuleWeight, string> = {
  strong: 'border-grid-strong',
  hour: 'border-border',
  quarter: 'border-border/45',
};

/** Every rule of the window: one per hour boundary, then one per quarter between them. */
function gridRules(window: GridWindow, startEdgeDrawn: boolean): Rule[] {
  const rules: Rule[] = hourRules(window)
    .filter((rule) => !(startEdgeDrawn && rule.offset === 0))
    .map((rule) => ({
      offset: rule.offset,
      weight: rule.strong ? 'strong' : 'hour',
    }));
  const quarters = quarterCount(window);
  for (let offset = 1; offset < quarters; offset += 1) {
    if (offset % QUARTERS_PER_HOUR !== 0) {
      rules.push({ offset, weight: 'quarter' });
    }
  }
  return rules;
}

// A rule sits on the leading side of the quarter it opens; the closing edge sits on the
// trailing side of the last quarter.
function ruleProps(
  rule: Rule,
  quarters: number,
  orientation: Orientation,
): { className: string; style: CSSProperties } {
  const atEnd = rule.offset === quarters;
  const track = `${String(FIRST_TIME_INDEX + (atEnd ? rule.offset - 1 : rule.offset))} / span 1`;
  const days = `${String(FIRST_DAY_INDEX)} / -1`;
  const portrait = orientation === 'portrait';
  const side = portrait
    ? atEnd
      ? 'border-b'
      : 'border-t'
    : atEnd
      ? 'border-r'
      : 'border-l';
  return {
    className: `pointer-events-none ${side} ${RULE_COLOR[rule.weight]}`,
    style: portrait
      ? { gridColumn: days, gridRow: track }
      : { gridColumn: track, gridRow: days },
  };
}

interface GridRulesProps {
  window: GridWindow;
  orientation: Orientation;
  /**
   * The sticky day column already draws the window start rule as its edge, so the grid
   * skips it. Both rules are translucent, so drawing the two would darken the start.
   */
  startEdgeDrawn: boolean;
}

export function GridRules({
  window,
  orientation,
  startEdgeDrawn,
}: GridRulesProps) {
  // The rules follow only the window, so they hold stable across a drag or a plan change.
  const { rules, quarters } = useMemo(
    () => ({
      rules: gridRules(window, startEdgeDrawn),
      quarters: quarterCount(window),
    }),
    [window, startEdgeDrawn],
  );

  return (
    <>
      {rules.map((rule) => (
        <div
          key={rule.offset}
          aria-hidden
          {...ruleProps(rule, quarters, orientation)}
        />
      ))}
    </>
  );
}
