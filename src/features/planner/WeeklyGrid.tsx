// The weekly timetable. Days are rows Sunday through Saturday and time is columns
// of 15 minute quarters. Every block position derives from minutes through the
// grid geometry, never from pixels: a meeting maps to grid column lines and its
// day row. A per day lane draws the hour and quarter gridlines with a gradient so
// the line count follows the window without a cell per quarter.

import { Fragment, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useStore } from 'zustand';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { formatMinutes } from '@/lib/parsing/time';
import {
  hourTicks,
  meetingColumns,
  quarterCount,
  type GridWindow,
} from '@/lib/planner/grid';
import { dragStore } from './dragStore';
import { EventBlock } from './EventBlock';
import type { PlacedSection } from './placedSection';

const AXIS_ROW = 1;
const FIRST_DAY_ROW = 2;
const FIRST_TIME_COLUMN = 2; // the grid line just after the day label column
const QUARTERS_PER_HOUR = 4;

/** Layered gradients that draw the hour lines and the fainter quarter lines. */
function laneBackground(quarters: number): string {
  const quarterPct = 100 / quarters;
  const hourPct = quarterPct * QUARTERS_PER_HOUR;
  const hourLine = 'var(--kcp-border)';
  const quarterLine = 'color-mix(in srgb, var(--kcp-border) 45%, transparent)';
  return [
    `repeating-linear-gradient(to right, ${hourLine} 0, ${hourLine} 1px, transparent 1px, transparent ${String(hourPct)}%)`,
    `repeating-linear-gradient(to right, ${quarterLine} 0, ${quarterLine} 1px, transparent 1px, transparent ${String(quarterPct)}%)`,
  ].join(', ');
}

function blockStyle(meeting: Meeting, window: GridWindow): CSSProperties {
  const columns = meetingColumns(meeting.startMin, meeting.endMin, window);
  return {
    gridRow: FIRST_DAY_ROW + meeting.day,
    gridColumn: `${String(FIRST_TIME_COLUMN + columns.startQuarter)} / ${String(FIRST_TIME_COLUMN + columns.endQuarter)}`,
  };
}

interface WeeklyGridProps {
  sections: PlacedSection[];
  window: GridWindow;
  locale: Locale;
  t: Translate;
}

export function WeeklyGrid({ sections, window, locale, t }: WeeklyGridProps) {
  const quarters = quarterCount(window);
  // The last tick is the window's closing edge and needs no hour column label.
  const ticks = hourTicks(window).slice(0, -1);
  const lane = laneBackground(quarters);
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `2.25rem repeat(${String(quarters)}, minmax(0, 1fr))`,
    gridTemplateRows: `auto repeat(${String(WEEK_DAYS.length)}, minmax(2.5rem, 1fr))`,
  };

  const active = useStore(dragStore, (state) => state.active);
  const hover = useStore(dragStore, (state) => state.hover);
  const blocked = active !== null && !active.placement.ok;
  const blockingIds = useMemo(() => {
    const ids = new Set<string>();
    if (active !== null && !active.placement.ok) {
      for (const conflict of active.placement.conflicts) {
        if (conflict.kind === 'time') {
          ids.add(conflict.blocking.teachTableId);
        }
      }
    }
    return ids;
  }, [active]);

  return (
    <div
      role="group"
      aria-label={t('grid.label')}
      className={`grid h-full min-w-[44rem] text-ink ${blocked ? 'cursor-not-allowed' : ''}`}
      style={gridStyle}
    >
      {ticks.map((min, index) => (
        <div
          key={min}
          aria-hidden
          className="border-l border-border pl-1 text-[11px] text-ink-soft"
          style={{
            gridRow: AXIS_ROW,
            gridColumn: `${String(FIRST_TIME_COLUMN + index * QUARTERS_PER_HOUR)} / span ${String(QUARTERS_PER_HOUR)}`,
          }}
        >
          {formatMinutes(min)}
        </div>
      ))}

      {WEEK_DAYS.map((day) => (
        <Fragment key={day}>
          <div
            className={`flex items-center justify-center border-t border-border text-xs font-medium text-ink-soft ${day % 2 === 1 ? 'bg-surface-alt' : ''}`}
            style={{ gridRow: FIRST_DAY_ROW + day, gridColumn: 1 }}
            title={t(dayFullLabelKey(day))}
            aria-label={t(dayFullLabelKey(day))}
          >
            {t(dayLabelKey(day))}
          </div>
          <div
            aria-hidden
            className={`border-t border-border ${day % 2 === 1 ? 'bg-surface-alt' : ''}`}
            style={{
              gridRow: FIRST_DAY_ROW + day,
              gridColumn: `${String(FIRST_TIME_COLUMN)} / -1`,
              backgroundImage: lane,
            }}
          />
        </Fragment>
      ))}

      {sections.flatMap((section) =>
        section.meetings.map((meeting) => (
          <EventBlock
            key={`${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`}
            section={section}
            meeting={meeting}
            style={blockStyle(meeting, window)}
            locale={locale}
            t={t}
            pulsing={blockingIds.has(section.teachTableId)}
          />
        )),
      )}

      {active !== null
        ? active.group.flatMap((groupSection) =>
            groupSection.meetings.map((meeting) => (
              <div
                key={`ghost-${groupSection.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`}
                aria-hidden
                data-ghost={active.placement.ok ? 'valid' : 'blocked'}
                className={`pointer-events-none m-px rounded-kcp border ${
                  active.placement.ok
                    ? 'border-success bg-success-soft'
                    : 'kcp-hatch border-danger bg-danger-soft'
                }`}
                style={blockStyle(meeting, window)}
              />
            )),
          )
        : null}

      {active === null && hover !== null
        ? hover.meetings.map((meeting) => (
            <div
              key={`hover-${String(meeting.day)}-${String(meeting.startMin)}`}
              aria-hidden
              data-ghost="hover"
              className="pointer-events-none m-px rounded-kcp border border-dashed border-ink-soft"
              style={blockStyle(meeting, window)}
            />
          ))
        : null}
    </div>
  );
}
