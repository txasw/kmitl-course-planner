// The weekly timetable. In the landscape layout days are rows Sunday through Saturday
// and time is columns of 15 minute quarters; the portrait layout transposes it, days as
// columns and time flowing down as rows, so a tall export canvas fills top to bottom
// rather than a thin band (ADR, orientation is a template property). Every block position
// derives from minutes through the grid geometry, never from pixels: a meeting maps to
// grid lines and its day track. A per day lane draws the hour and quarter gridlines with a
// gradient so the line count follows the window without a cell per quarter. The axis hour
// labels center on their gridline and read as an even ruler, with a stronger rule at
// midday and the window edges. The poster font size scales the whole grid per template.

import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { useStore } from 'zustand';
import type { Meeting } from '@/lib/domain/types';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import type { Locale, Translate } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import { Tooltip } from '@/components/Tooltip';
import { WEEK_DAYS, type DayOfWeek } from '@/lib/parsing/days';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import { formatMinutes } from '@/lib/parsing/time';
import {
  QUARTER_MIN,
  hourTicks,
  meetingColumns,
  quarterCount,
  type GridWindow,
} from '@/lib/planner/grid';
import { candidateFootprints } from '@/lib/planner/candidateLayout';
import { dayTint } from '@/lib/planner/dayColors';
import { dragStore } from './dragStore';
import { BlockHoverCard } from './BlockHoverCard';
import { CandidateSlot } from './CandidateSlot';
import { EventBlock } from './EventBlock';
import { DraggableBlock } from './DraggableBlock';
import { SwapTarget } from './SwapTarget';
import type { PlacedSection } from './placedSection';

type Orientation = 'landscape' | 'portrait';

const MAX_STACK_OFFSET = 4;
const STACK_STEP_PX = 5;
const HOVER_DELAY_MS = 400;

const AXIS_INDEX = 1; // the leading axis track: landscape row 1, portrait column 1
const FIRST_DAY_INDEX = 2; // first day track: landscape row 2, portrait column 2
const FIRST_TIME_INDEX = 2; // first quarter track: landscape column 2, portrait row 2
const QUARTERS_PER_HOUR = 4;
const NOON_MIN = 12 * 60;
const EMPHASIS_LINE =
  'color-mix(in srgb, var(--kcp-ink-soft) 30%, transparent)';

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

// The day track derives from the day's position in the rendered run, not the day number,
// so a preview that trims leading days still places each block correctly. With the full
// week the position equals the day, so edit mode geometry is unchanged. In portrait the
// day is the column and the time span is the rows; in landscape it is the reverse.
function blockStyle(
  meeting: Meeting,
  window: GridWindow,
  days: readonly DayOfWeek[],
  orientation: Orientation,
): CSSProperties {
  const columns = meetingColumns(meeting.startMin, meeting.endMin, window);
  const dayTrack = FIRST_DAY_INDEX + days.indexOf(meeting.day);
  const timeStart = FIRST_TIME_INDEX + columns.startQuarter;
  const timeEnd = FIRST_TIME_INDEX + columns.endQuarter;
  if (orientation === 'portrait') {
    return {
      gridColumn: dayTrack,
      gridRow: `${String(timeStart)} / ${String(timeEnd)}`,
    };
  }
  return {
    gridRow: dayTrack,
    gridColumn: `${String(timeStart)} / ${String(timeEnd)}`,
  };
}

function gridTemplate(
  quarters: number,
  dayCount: number,
  orientation: Orientation,
): CSSProperties {
  // The leading axis track is a fixed size, not auto: the hour labels are absolutely
  // positioned so they can center on their gridline, which means they add no flow height,
  // so an auto track would collapse and hide them.
  if (orientation === 'portrait') {
    return {
      gridTemplateColumns: `2.75rem repeat(${String(dayCount)}, minmax(0, 1fr))`,
      gridTemplateRows: `1.4em repeat(${String(quarters)}, minmax(0, 1fr))`,
    };
  }
  return {
    gridTemplateColumns: `2.25rem repeat(${String(quarters)}, minmax(0, 1fr))`,
    gridTemplateRows: `1.4em repeat(${String(dayCount)}, minmax(2.5rem, 1fr))`,
  };
}

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

interface WeeklyGridProps {
  sections: PlacedSection[];
  window: GridWindow;
  locale: Locale;
  t: Translate;
  /** Whether blocks are drag sources with a remove control (edit mode only). */
  editable?: boolean;
  /** Remove a placed section and its pair, wired in edit mode. */
  onRemove?: (teachTableId: string) => void;
  /** teachTableIds a revalidation time change put into a new conflict. */
  conflictIds?: Set<string>;
  /** teachTableIds whose exam window overlaps another placed entry's, reading danger. */
  examConflictIds?: Set<string>;
  /** The exam overlaps per teachTableId, for the hover detail card. */
  examOverlaps?: Map<string, ExamOverlap[]>;
  /** Open the block detail popover anchored to a block, edit mode only. */
  onOpenDetail?: (anchor: HTMLElement) => void;
  /** Open the block context menu at the pointer on a right click, edit mode only. */
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  /** Whether a block detail popover is pinned open. The hover card never spawns while a
   * popover is pinned, so the two detail surfaces never show at once. */
  detailOpen?: boolean;
  /** The day tracks to render, in order. Defaults to the full week; preview passes a
   * trimmed contiguous run. */
  days?: readonly DayOfWeek[];
  /** Preview field toggles. Omitted in edit mode, where blocks show every field. */
  display?: DisplayOptions;
  /** Tint the day labels with the traditional Thai day colors. On only when the poster
   * renders into an export template (preview), never in edit mode (ADR-0042). */
  dayAccent?: boolean;
  /** Landscape (days as rows) or portrait (days as columns). Portrait is preview only. */
  orientation?: Orientation;
  /** The grid root font size in CSS pixels; every grid text node scales from it, so a
   * template can shrink its type scale a step. Defaults to the edit mode 11px. */
  fontPx?: number;
}

export function WeeklyGrid({
  sections,
  window,
  locale,
  t,
  editable = false,
  onRemove,
  conflictIds,
  examConflictIds,
  examOverlaps,
  onOpenDetail,
  onContextMenu,
  detailOpen = false,
  days = WEEK_DAYS,
  display,
  dayAccent = false,
  orientation = 'landscape',
  fontPx = 11,
}: WeeklyGridProps) {
  // The grid geometry follows only the window, the day tracks, and the orientation, so it
  // holds stable across a drag or a plan change and is computed once per those inputs.
  const { ticks, lane, gridStyle, emphasis } = useMemo(() => {
    const quarters = quarterCount(window);
    return {
      // The last tick is the window's closing edge and needs no label.
      ticks: hourTicks(window).slice(0, -1),
      lane: laneBackground(quarters, orientation),
      gridStyle: gridTemplate(quarters, days.length, orientation),
      emphasis: emphasisOffsets(window, quarters),
    };
  }, [window, days, orientation]);
  const showRoom = display?.showRoom ?? true;
  const showSection = display?.showSection ?? true;
  const showEnglishName = display?.showEnglishNames ?? false;
  const isPortrait = orientation === 'portrait';

  const active = useStore(dragStore, (state) => state.active);
  const hover = useStore(dragStore, (state) => state.hover);
  const courseDrag = useStore(dragStore, (state) => state.courseDrag);
  const blockMove = useStore(dragStore, (state) => state.blockMove);
  const raised = useStore(dragStore, (state) => state.raised);
  const swapContext = useStore(dragStore, (state) => state.swapContext);
  const blocked = active !== null && !active.placement.ok;
  const removeLabel = t('action.remove');

  // The hover detail card: after a short delay on a hovered block, open a read-only card
  // with its full detail set, never during a drag. The delay avoids a flicker as the
  // pointer crosses blocks. The card is edit mode only, the interactive surface.
  const [hoverDetail, setHoverDetail] = useState<{
    teachTableId: string;
    anchor: HTMLElement;
  } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHoverEnter = useCallback((anchor: HTMLElement) => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
    }
    if (dragStore.getState().active !== null) {
      return;
    }
    const teachTableId = anchor.dataset.teachTableId;
    if (teachTableId === undefined) {
      return;
    }
    hoverTimer.current = setTimeout(() => {
      setHoverDetail({ teachTableId, anchor });
    }, HOVER_DELAY_MS);
  }, []);
  const handleHoverLeave = useCallback(() => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoverDetail(null);
  }, []);
  // When a detail popover pins or unpins, drop any shown hover card so it never lingers next
  // to the pinned popover and none flashes as the popover closes. The render gate below keeps
  // a pending hover from surfacing while pinned, and a pending timer is cleared on mouse leave
  // or replaced by the next hover, so only the shown card needs clearing here. This is the
  // render time adjust on change pattern, not an effect.
  const [prevDetailOpen, setPrevDetailOpen] = useState(detailOpen);
  if (detailOpen !== prevDetailOpen) {
    setPrevDetailOpen(detailOpen);
    if (hoverDetail !== null) {
      setHoverDetail(null);
    }
  }
  const swapBlockers =
    swapContext === null ? new Set<string>() : new Set(swapContext.blockers);
  // Candidate slots come from a course drag or a block move, whichever is active.
  const candidates = courseDrag?.candidates ?? blockMove?.candidates ?? null;
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
    <div
      role="group"
      aria-label={t('grid.label')}
      className={`grid h-full text-ink ${isPortrait ? 'min-h-[44rem]' : 'min-w-[44rem]'} ${blocked ? 'cursor-not-allowed' : ''}`}
      style={{ ...gridStyle, fontSize: `${String(fontPx)}px` }}
    >
      {ticks.map((min, index) => {
        const track = FIRST_TIME_INDEX + index * QUARTERS_PER_HOUR;
        const first = index === 0;
        return (
          <div
            key={min}
            aria-hidden
            className="relative overflow-visible text-[0.92em] text-ink-soft"
            style={
              isPortrait
                ? {
                    gridColumn: 1,
                    gridRow: `${String(track)} / span ${String(QUARTERS_PER_HOUR)}`,
                  }
                : {
                    gridRow: AXIS_INDEX,
                    gridColumn: `${String(track)} / span ${String(QUARTERS_PER_HOUR)}`,
                  }
            }
          >
            <span
              className="absolute whitespace-nowrap"
              style={
                isPortrait
                  ? {
                      right: '0.35em',
                      top: 0,
                      transform: first ? 'none' : 'translateY(-50%)',
                    }
                  : {
                      bottom: 0,
                      left: 0,
                      transform: first ? 'none' : 'translateX(-50%)',
                    }
              }
            >
              {formatMinutes(min)}
            </span>
          </div>
        );
      })}

      {emphasis.map((offset) => {
        const quarters = quarterCount(window);
        return (
          <div
            key={`emph-${String(offset)}`}
            aria-hidden
            className="pointer-events-none"
            style={emphasisStyle(offset, quarters, orientation)}
          />
        );
      })}

      {days.map((day, index) => {
        const dayTrack = FIRST_DAY_INDEX + index;
        const alt = !dayAccent && day % 2 === 1 ? 'bg-surface-alt' : '';
        return (
          <Fragment key={day}>
            <Tooltip label={t(dayFullLabelKey(day))}>
              {(triggerProps, ref) => (
                <div
                  ref={ref}
                  {...triggerProps}
                  className={`flex items-center justify-center text-[1.05em] font-medium ${
                    dayAccent ? 'text-ink' : 'text-ink-soft'
                  } ${isPortrait ? 'border-b border-border' : 'border-t border-border'} ${alt}`}
                  style={{
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
          ...(editable
            ? {
                onHoverEnter: handleHoverEnter,
                onHoverLeave: handleHoverLeave,
              }
            : {}),
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
          />
        );
      })}

      {editable && active !== null
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
                style={blockStyle(meeting, window, days, orientation)}
              />
            )),
          )
        : null}

      {editable && active === null && hover !== null
        ? hover.meetings.map((meeting) => (
            <div
              key={`hover-${String(meeting.day)}-${String(meeting.startMin)}`}
              aria-hidden
              data-ghost="hover"
              className="pointer-events-none m-px rounded-kcp border border-dashed border-ink-soft"
              style={blockStyle(meeting, window, days, orientation)}
            />
          ))
        : null}

      {editable && candidates !== null
        ? candidateFootprints(candidates, window).map((footprint) => {
            const offset =
              Math.min(footprint.stack, MAX_STACK_OFFSET) * STACK_STEP_PX;
            const id = `cand-${footprint.candidate.section.teachTableId}-${String(footprint.meeting.day)}-${String(footprint.meeting.startMin)}`;
            return (
              <CandidateSlot
                key={id}
                id={id}
                candidate={footprint.candidate}
                raised={footprint.candidate.section.teachTableId === raised}
                style={{
                  ...blockStyle(footprint.meeting, window, days, orientation),
                  marginLeft: `${String(offset)}px`,
                  marginTop: `${String(offset)}px`,
                }}
              />
            );
          })
        : null}

      {editable && swapContext !== null
        ? sections
            .filter((section) => swapBlockers.has(section.teachTableId))
            .flatMap((section) =>
              section.meetings.map((meeting) => {
                const id = `swap-${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`;
                return (
                  <SwapTarget
                    key={id}
                    id={id}
                    blockerTeachTableId={section.teachTableId}
                    incomingLabel={swapContext.incoming.section}
                    style={blockStyle(meeting, window, days, orientation)}
                  />
                );
              }),
            )
        : null}

      {editable && active === null && !detailOpen && hoverDetail !== null ? (
        <BlockHoverCard
          teachTableId={hoverDetail.teachTableId}
          anchor={hoverDetail.anchor}
          locale={locale}
          t={t}
          examOverlaps={examOverlaps?.get(hoverDetail.teachTableId) ?? []}
          onClose={handleHoverLeave}
        />
      ) : null}
    </div>
  );
}
