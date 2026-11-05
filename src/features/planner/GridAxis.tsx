// The time axis of the weekly grid: the hour labels along the leading track and the
// stronger rules at the window start, midday, and end. Each label is a grid item placed on
// its hour span and aligned to the span's leading line, then shifted half its own size so it
// centers on the gridline and reads as an even ruler. The first label stays inside the grid
// rather than overhanging the corner. The corner where the two axes meet stays empty.
// Renders a fragment so every item is a direct child of the grid and places by track index.

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
  FIRST_DAY_INDEX,
  FIRST_TIME_INDEX,
  QUARTERS_PER_HOUR,
  type Orientation,
} from './gridGeometry';

const NOON_MIN = 12 * 60;
const EMPHASIS_LINE =
  'color-mix(in srgb, var(--kcp-ink-soft) 30%, transparent)';

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

interface GridAxisProps {
  window: GridWindow;
  orientation: Orientation;
}

export function GridAxis({ window, orientation }: GridAxisProps) {
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
  const isPortrait = orientation === 'portrait';

  return (
    <>
      {ticks.map((min, index) => {
        const track = FIRST_TIME_INDEX + index * QUARTERS_PER_HOUR;
        const first = index === 0;
        return (
          <div
            key={min}
            aria-hidden
            className="whitespace-nowrap text-[0.92em] text-ink-soft"
            style={
              isPortrait
                ? {
                    gridColumn: AXIS_INDEX,
                    gridRow: `${String(track)} / span ${String(QUARTERS_PER_HOUR)}`,
                    alignSelf: 'start',
                    justifySelf: 'end',
                    marginRight: '0.35em',
                    transform: first ? 'none' : 'translateY(-50%)',
                  }
                : {
                    gridRow: AXIS_INDEX,
                    gridColumn: `${String(track)} / span ${String(QUARTERS_PER_HOUR)}`,
                    alignSelf: 'end',
                    justifySelf: 'start',
                    transform: first ? 'none' : 'translateX(-50%)',
                  }
            }
          >
            {formatMinutes(min)}
          </div>
        );
      })}

      {emphasis.map((offset) => (
        <div
          key={`emph-${String(offset)}`}
          aria-hidden
          className="pointer-events-none"
          style={emphasisStyle(offset, quarters, orientation)}
        />
      ))}
    </>
  );
}
