// The day tracks of the weekly grid: a label and a lane per rendered day, and the placed
// blocks over them. A per day lane draws the hour and quarter gridlines with a gradient so
// the line count follows the window without a cell per quarter. In edit mode each block is
// a drag source; in preview it is a plain block that fits its fields to its box. Renders a
// fragment so every item is a direct child of the grid and places by track index. In edit
// the day labels are sticky inside the planner scroller on an opaque fill, so the day stays
// readable while the time scrolls beneath it; the poster renders them flat.

import { Fragment, useMemo } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { useStore } from 'zustand';
import type { Locale, Translate } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import { Tooltip } from '@/components/Tooltip';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import { quarterCount, type GridWindow } from '@/lib/planner/grid';
import { dayTint } from '@/lib/planner/dayColors';
import { dragStore } from './dragStore';
import { EventBlock } from './EventBlock';
import { DraggableBlock } from './DraggableBlock';
import type { PlacedSection } from './placedSection';
import {
  EMPHASIS_LINE,
  FIRST_DAY_INDEX,
  FIRST_TIME_INDEX,
  QUARTERS_PER_HOUR,
  blockStyle,
  type Orientation,
} from './gridGeometry';

/** Layered gradients that draw the hour lines and the fainter quarter lines. The lines run
 * across the time axis, so they are vertical in landscape and horizontal in portrait. */
function laneBackground(quarters: number, orientation: Orientation): string {
  const direction = orientation === 'portrait' ? 'to bottom' : 'to right';
  const quarterPct = 100 / quarters;
  const hourPct = quarterPct * QUARTERS_PER_HOUR;
  const hourLine = 'var(--kcp-border)';
  const quarterLine = 'color-mix(in srgb, var(--kcp-border) 45%, transparent)';
  return [
    `repeating-linear-gradient(${direction}, ${hourLine} 0, ${hourLine} 1px, transparent 1px, transparent ${String(hourPct)}%)`,
    `repeating-linear-gradient(${direction}, ${quarterLine} 0, ${quarterLine} 1px, transparent 1px, transparent ${String(quarterPct)}%)`,
  ].join(', ');
}

// A sticky day label pins to the scroller edge the days run along: the left in landscape,
// the top in portrait. The landscape column's trailing edge is the window start, so it
// draws the stronger start rule as a shadow that stays put while the lanes scroll.
function stickyDayStyle(orientation: Orientation): CSSProperties {
  return orientation === 'portrait'
    ? { position: 'sticky', top: 0 }
    : {
        position: 'sticky',
        left: 0,
        boxShadow: `1px 0 0 ${EMPHASIS_LINE}`,
      };
}

interface DayLanesProps {
  sections: PlacedSection[];
  window: GridWindow;
  days: readonly DayOfWeek[];
  orientation: Orientation;
  locale: Locale;
  t: Translate;
  editable: boolean;
  onRemove: ((teachTableId: string) => void) | undefined;
  conflictIds: Set<string> | undefined;
  examConflictIds: Set<string> | undefined;
  onOpenDetail: ((anchor: HTMLElement) => void) | undefined;
  onContextMenu: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  onHoverEnter: (anchor: HTMLElement) => void;
  onHoverLeave: () => void;
  display: DisplayOptions | undefined;
  dayAccent: boolean;
  fontPx: number;
  /** Pin the day labels to the scroller edge, edit mode only. */
  sticky: boolean;
}

export function DayLanes({
  sections,
  window,
  days,
  orientation,
  locale,
  t,
  editable,
  onRemove,
  conflictIds,
  examConflictIds,
  onOpenDetail,
  onContextMenu,
  onHoverEnter,
  onHoverLeave,
  display,
  dayAccent,
  fontPx,
  sticky,
}: DayLanesProps) {
  // The lane gradient follows only the window and the orientation, so it holds stable
  // across a drag or a plan change.
  const lane = useMemo(
    () => laneBackground(quarterCount(window), orientation),
    [window, orientation],
  );
  const showRoom = display?.showRoom ?? true;
  const showSection = display?.showSection ?? true;
  const showEnglishName = display?.showEnglishNames ?? false;
  const showSubjectId = display?.showSubjectId ?? false;
  const isPortrait = orientation === 'portrait';
  const removeLabel = t('action.remove');

  const active = useStore(dragStore, (state) => state.active);
  const blockMove = useStore(dragStore, (state) => state.blockMove);
  const movingIds = useMemo(
    () =>
      new Set(blockMove?.group.map((section) => section.teachTableId) ?? []),
    [blockMove],
  );
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
  // Emit the blocks in day then start time then subject order, the same order the copy as
  // text export uses, so the reading and tab order follow one chronological schedule rather
  // than plan entry order. Visual position comes from the grid coordinates, not the DOM
  // order, so the sort changes only what a screen reader and the keyboard walk traverse.
  const orderedBlocks = useMemo(
    () =>
      sections
        .flatMap((section) =>
          section.meetings.map((meeting) => ({
            section,
            meeting,
            key: `${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`,
            style: blockStyle(meeting, window, days, orientation),
          })),
        )
        .sort(
          (a, b) =>
            a.meeting.day - b.meeting.day ||
            a.meeting.startMin - b.meeting.startMin ||
            a.section.subjectId.localeCompare(b.section.subjectId),
        ),
    [sections, window, days, orientation],
  );

  return (
    <>
      {days.map((day, index) => {
        const dayTrack = FIRST_DAY_INDEX + index;
        const alt = !dayAccent && day % 2 === 1 ? 'bg-surface-alt' : '';
        // A sticky label covers the lanes scrolling under it, so it needs an opaque fill.
        const labelFill = alt === '' && sticky ? 'bg-surface' : alt;
        return (
          <Fragment key={day}>
            <Tooltip label={t(dayFullLabelKey(day))}>
              {(triggerProps, ref) => (
                <div
                  ref={ref}
                  {...triggerProps}
                  className={`flex items-center justify-center text-[1.05em] font-semibold ${
                    dayAccent ? 'text-ink' : 'text-ink-soft'
                  } ${isPortrait ? 'border-b border-border' : 'border-t border-border'} ${labelFill} ${sticky ? 'z-sticky' : ''}`}
                  style={{
                    ...(sticky ? stickyDayStyle(orientation) : {}),
                    ...(isPortrait
                      ? { gridColumn: dayTrack, gridRow: 1 }
                      : { gridRow: dayTrack, gridColumn: 1 }),
                    ...(dayAccent ? { backgroundColor: dayTint(day) } : {}),
                  }}
                  aria-label={t(dayFullLabelKey(day))}
                >
                  {t(dayLabelKey(day))}
                </div>
              )}
            </Tooltip>
            <div
              aria-hidden
              className={`${isPortrait ? 'border-l border-border' : 'border-t border-border'} ${alt}`}
              style={{
                ...(isPortrait
                  ? {
                      gridColumn: dayTrack,
                      gridRow: `${String(FIRST_TIME_INDEX)} / -1`,
                    }
                  : {
                      gridRow: dayTrack,
                      gridColumn: `${String(FIRST_TIME_INDEX)} / -1`,
                    }),
                backgroundImage: lane,
              }}
            />
          </Fragment>
        );
      })}

      {orderedBlocks.map(({ section, meeting, key, style }) => {
        const common = {
          section,
          meeting,
          style,
          locale,
          t,
          pulsing: blockingIds.has(section.teachTableId),
          dimmed: movingIds.has(section.teachTableId),
          conflicted: conflictIds?.has(section.teachTableId) ?? false,
          examConflicted: examConflictIds?.has(section.teachTableId) ?? false,
          ...(editable && onOpenDetail !== undefined ? { onOpenDetail } : {}),
          ...(editable && onContextMenu !== undefined ? { onContextMenu } : {}),
          ...(editable ? { onHoverEnter, onHoverLeave } : {}),
        };
        return editable && onRemove ? (
          <DraggableBlock
            key={key}
            {...common}
            onRemove={onRemove}
            removeLabel={removeLabel}
          />
        ) : (
          <EventBlock
            key={key}
            {...common}
            showRoom={showRoom}
            showSection={showSection}
            showEnglishName={showEnglishName}
            showSubjectId={showSubjectId}
            fitToBox={!editable}
            fitKey={`${String(fontPx)}|${orientation}|${String(window.startMin)}|${String(window.endMin)}|${String(days.length)}|${String(style.gridRow ?? '')}|${String(style.gridColumn ?? '')}`}
          />
        );
      })}
    </>
  );
}
