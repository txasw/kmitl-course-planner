// The weekly timetable. In the landscape layout days are rows Sunday through Saturday
// and time is columns of 15 minute quarters; the portrait layout transposes it, days as
// columns and time flowing down as rows, so a tall export canvas fills top to bottom
// rather than a thin band (ADR, orientation is a template property). Every block position
// derives from minutes through the grid geometry, never from pixels: a meeting maps to
// grid lines and its day track. GridAxis draws the hour labels, DayLanes draws the day
// labels, the row lanes, and the placed blocks, GridRules draws the hour and quarter rules
// once across every lane, and CandidateLayer draws the edit mode drag feedback over them.
// This component owns the grid template and the hover detail card. The poster font size
// scales the whole grid per template. In edit the day and hour axes stick to the planner scroller edges so a grid
// wider or taller than its column stays readable; the poster is flat (ADR-0050).

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { useStore } from 'zustand';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import type { Locale, Translate } from '@/lib/i18n/t';
import { WEEK_DAYS, type DayOfWeek } from '@/lib/parsing/days';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import {
  EDIT_DAY_AXIS_PX,
  editGridMinWidth,
  quarterCount,
  type GridWindow,
} from '@/lib/planner/grid';
import { dragStore } from './dragStore';
import { BlockHoverCard } from './BlockHoverCard';
import { CandidateLayer } from './CandidateLayer';
import { DayLanes } from './DayLanes';
import { GridAxis } from './GridAxis';
import { GridRules } from './GridRules';
import type { PlacedSection } from './placedSection';
import type { Orientation } from './gridGeometry';

const HOVER_DELAY_MS = 400;

function gridTemplate(
  window: GridWindow,
  dayCount: number,
  orientation: Orientation,
  editable: boolean,
): CSSProperties {
  const quarters = quarterCount(window);
  // The leading axis track is a fixed size, not auto: each hour label shifts half its size
  // to center on its gridline, so the track sets the axis height and width rather than the
  // labels, and the axis keeps one size across windows, locales, and templates.
  if (orientation === 'portrait') {
    return {
      gridTemplateColumns: `2.75rem repeat(${String(dayCount)}, minmax(0, 1fr))`,
      gridTemplateRows: `1.4em repeat(${String(quarters)}, minmax(0, 1fr))`,
    };
  }
  const rows = `1.4em repeat(${String(dayCount)}, minmax(2.5rem, 1fr))`;
  // The edit grid derives its minimum from the window, so the day column is the fixed
  // width that minimum counts. The poster keeps its own column and the 44rem floor, since
  // its template canvas, not the window, sets its width.
  if (editable) {
    return {
      gridTemplateColumns: `${String(EDIT_DAY_AXIS_PX)}px repeat(${String(quarters)}, minmax(0, 1fr))`,
      gridTemplateRows: rows,
      minWidth: `${String(editGridMinWidth(window))}px`,
    };
  }
  return {
    gridTemplateColumns: `2.25rem repeat(${String(quarters)}, minmax(0, 1fr))`,
    gridTemplateRows: rows,
  };
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
  // The grid template follows only the window, the day count, the orientation, and the
  // mode, so it holds stable across a drag or a plan change and is computed once per those
  // inputs.
  const gridStyle = useMemo(
    () => gridTemplate(window, days.length, orientation, editable),
    [window, days, orientation, editable],
  );
  const isPortrait = orientation === 'portrait';
  const floor = isPortrait ? 'min-h-[44rem]' : editable ? '' : 'min-w-[44rem]';

  const active = useStore(dragStore, (state) => state.active);
  const blocked = active !== null && !active.placement.ok;

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

  return (
    <div
      role="group"
      aria-label={t('grid.label')}
      className={`grid h-full leading-normal text-ink ${floor} ${blocked ? 'cursor-not-allowed' : ''}`}
      style={{ ...gridStyle, fontSize: `${String(fontPx)}px` }}
    >
      <GridAxis window={window} orientation={orientation} sticky={editable} />

      <DayLanes
        sections={sections}
        window={window}
        days={days}
        orientation={orientation}
        locale={locale}
        t={t}
        editable={editable}
        onRemove={onRemove}
        conflictIds={conflictIds}
        examConflictIds={examConflictIds}
        onOpenDetail={onOpenDetail}
        onContextMenu={onContextMenu}
        onHoverEnter={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        display={display}
        dayAccent={dayAccent}
        fontPx={fontPx}
        sticky={editable}
      />

      <GridRules window={window} orientation={orientation} />

      {editable ? (
        <CandidateLayer
          sections={sections}
          window={window}
          days={days}
          orientation={orientation}
        />
      ) : null}

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
