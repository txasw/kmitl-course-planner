// The time axis of the weekly grid: the hour labels along the leading track and the
// stronger rules at the window start, midday, and end. Each label is a grid item placed on
// its hour span and aligned to the span's leading line, then shifted half its own size so it
// centers on the gridline and reads as an even ruler. The first label stays inside the grid
// rather than overhanging the corner. In edit the axis is sticky inside the planner scroller:
// a surface band under the labels and a corner cell over both axes keep the hours readable
// while the lanes scroll beneath them. The poster stays flat, so a capture sees no sticky
// offsets. Renders a fragment so every item is a direct child of the grid and places by
// track index.

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { formatMinutes } from '@/lib/parsing/time';
import {
  QUARTER_MIN,
  hourTicks,
  quarterCount,
  type GridWindow,
} from '@/lib/planner/grid';
import {
  AXIS_INDEX,
  EMPHASIS_LINE,
  FIRST_DAY_INDEX,
  FIRST_TIME_INDEX,
  QUARTERS_PER_HOUR,
  type Orientation,
} from './gridGeometry';

const NOON_MIN = 12 * 60;

/** The quarter offsets that carry a stronger rule: the window start, midday, and end. */
function emphasisOffsets(window: GridWindow, quarters: number): number[] {
  const offsets = [0, quarters];
  const noon = (NOON_MIN - window.startMin) / QUARTER_MIN;
  if (noon > 0 && noon < quarters) {
    offsets.push(noon);
  }
  return offsets;
}

function emphasisStyle(
  offset: number,
  quarters: number,
  orientation: Orientation,
): CSSProperties {
  // The end edge draws on the trailing side of the last cell; the rest on the leading side.
  const atEnd = offset === quarters;
  const track = atEnd
    ? FIRST_TIME_INDEX + offset - 1
    : FIRST_TIME_INDEX + offset;
  if (orientation === 'portrait') {
    const base: CSSProperties = {
      gridColumn: `${String(FIRST_DAY_INDEX)} / -1`,
      gridRow: `${String(track)} / span 1`,
    };
    return atEnd
      ? { ...base, borderBottom: `1px solid ${EMPHASIS_LINE}` }
      : { ...base, borderTop: `1px solid ${EMPHASIS_LINE}` };
  }
  const base: CSSProperties = {
    gridColumn: `${String(track)} / span 1`,
    gridRow: `${String(FIRST_DAY_INDEX)} / -1`,
  };
  return atEnd
    ? { ...base, borderRight: `1px solid ${EMPHASIS_LINE}` }
    : { ...base, borderLeft: `1px solid ${EMPHASIS_LINE}` };
}

// The sticky offset pins an axis to the scroller edge it runs along: the hour row to the
// top in landscape, the hour column to the left in portrait.
function stickTo(orientation: Orientation): CSSProperties {
  return orientation === 'portrait'
    ? { position: 'sticky', left: 0 }
    : { position: 'sticky', top: 0 };
}

// Each label fills the axis track across the time axis so its natural offset from the
// scroller edge is zero and a sticky label never drifts before it pins.
function labelStyle(
  track: number,
  first: boolean,
  orientation: Orientation,
  sticky: boolean,
): CSSProperties {
  const span = `${String(track)} / span ${String(QUARTERS_PER_HOUR)}`;
  const pinned = sticky ? stickTo(orientation) : {};
  if (orientation === 'portrait') {
    return {
      ...pinned,
      gridColumn: AXIS_INDEX,
      gridRow: span,
      alignSelf: 'start',
      paddingRight: '0.35em',
      textAlign: 'right',
      transform: first ? 'none' : 'translateY(-50%)',
    };
  }
  return {
    ...pinned,
    gridRow: AXIS_INDEX,
    gridColumn: span,
    display: 'flex',
    alignItems: 'flex-end',
    justifySelf: 'start',
    transform: first ? 'none' : 'translateX(-50%)',
  };
}

// The surface band the sticky labels sit on, spanning the time tracks of the axis track,
// with a 1 px rule drawn as a shadow so it lands on the first day track's own border rather
// than doubling it.
function bandStyle(orientation: Orientation): CSSProperties {
  return orientation === 'portrait'
    ? {
        ...stickTo(orientation),
        gridColumn: AXIS_INDEX,
        gridRow: `${String(FIRST_TIME_INDEX)} / -1`,
        boxShadow: '1px 0 0 var(--kcp-border)',
      }
    : {
        ...stickTo(orientation),
        gridRow: AXIS_INDEX,
        gridColumn: `${String(FIRST_TIME_INDEX)} / -1`,
        boxShadow: '0 1px 0 var(--kcp-border)',
      };
}

const CORNER_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  left: 0,
  gridRow: AXIS_INDEX,
  gridColumn: AXIS_INDEX,
};

interface GridAxisProps {
  window: GridWindow;
  orientation: Orientation;
  /** Pin the axis to the scroller edge, edit mode only. The poster renders flat. */
  sticky: boolean;
}

export function GridAxis({ window, orientation, sticky }: GridAxisProps) {
  // The axis follows only the window, so it holds stable across a drag or a plan change.
  const { ticks, quarters, emphasis } = useMemo(() => {
    const count = quarterCount(window);
    return {
      // The last tick is the window's closing edge and needs no label.
      ticks: hourTicks(window).slice(0, -1),
      quarters: count,
      emphasis: emphasisOffsets(window, count),
    };
  }, [window]);

  return (
    <>
      {sticky ? (
        <div
          aria-hidden
          className="pointer-events-none z-sticky bg-surface"
          style={bandStyle(orientation)}
        />
      ) : null}

      {ticks.map((min, index) => (
        <div
          key={min}
          aria-hidden
          className={`whitespace-nowrap text-[0.92em] text-ink-soft ${sticky ? 'z-sticky' : ''}`}
          style={labelStyle(
            FIRST_TIME_INDEX + index * QUARTERS_PER_HOUR,
            index === 0,
            orientation,
            sticky,
          )}
        >
          {formatMinutes(min)}
        </div>
      ))}

      {emphasis.map((offset) => (
        <div
          key={`emph-${String(offset)}`}
          aria-hidden
          className="pointer-events-none"
          style={emphasisStyle(offset, quarters, orientation)}
        />
      ))}

      {sticky ? (
        <div
          aria-hidden
          className="pointer-events-none z-sticky-corner bg-surface"
          style={CORNER_STYLE}
        />
      ) : null}
    </>
  );
}
