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
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
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
import type { BlockSurface } from './blockSurface';
import {
  AXIS_TRACK_EM,
  EDIT_FONT_PX,
  PORTRAIT_AXIS_TRACK,
  type Orientation,
} from './gridGeometry';

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
      gridTemplateColumns: `${PORTRAIT_AXIS_TRACK} repeat(${String(dayCount)}, minmax(0, 1fr))`,
      gridTemplateRows: `${String(AXIS_TRACK_EM)}em repeat(${String(quarters)}, minmax(0, 1fr))`,
    };
  }
  const rows = (rowMax: string) =>
    `${String(AXIS_TRACK_EM)}em repeat(${String(dayCount)}, minmax(2.5rem, ${rowMax}))`;
  // The edit grid derives its minimum from the window, so the day column is the fixed
  // width that minimum counts. Its day rows share the scroller's height, so a tall panel
  // gives the blocks room for their second name and foot rather than leaving a dead band
  // under the week; the edit foot follows the place, so a tall block keeps its fields in one
  // cluster. The poster keeps its own column and the 44rem floor, since the canvas, not the
  // window, sets its size.
  if (editable) {
    return {
      gridTemplateColumns: `${String(EDIT_DAY_AXIS_PX)}px repeat(${String(quarters)}, minmax(0, 1fr))`,
      gridTemplateRows: rows('1fr'),
      minWidth: `${String(editGridMinWidth(window))}px`,
    };
  }
  return {
    gridTemplateColumns: `2.25rem repeat(${String(quarters)}, minmax(0, 1fr))`,
    gridTemplateRows: rows('1fr'),
  };
}

export interface WeeklyGridProps {
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
  /** Whether a block surface is open: the pinned detail popover or the context menu. The
   * hover card never spawns while one is open, so it never sits over the popover or clips
   * the menu, which share its popover layer. */
  surfaceOpen?: boolean;
  /** A notice the grid centers over its body, such as the empty plan, as its own item
   * so it centers on the day rows rather than on whatever box holds the grid. */
  notice?: ReactNode;
  /** The day tracks to render, in order. Defaults to the full week; preview passes a
   * trimmed contiguous run. */
  days?: readonly DayOfWeek[];
  /** Preview field toggles. Omitted in edit mode, where blocks show every field. */
  display?: DisplayOptions;
  /** Tint the day labels with the traditional Thai day colors. On only when the poster
   * renders into an export template (preview), never in edit mode (ADR-0042). */
  dayAccent?: boolean;
  /** Landscape (days as rows) or portrait (days as columns). Portrait renders the export
   * templates that ask for it and the narrow edit timetable, its day view and its week. */
  orientation?: Orientation;
  /** The grid root font size in CSS pixels; every grid text node scales from it. Edit
   * passes the step for the measured scroller width, and a template passes its own
   * posterFontPx, so the scroller step never reaches an export. Defaults to the edit 11px. */
  fontPx?: number;
  /** The accessible name of the grid. Defaults to the weekly timetable; the day view names
   * the day it shows. */
  label?: string;
  /** Whether the poster keeps its 44rem floor along the time axis. The plan suggestion
   * cards pass false, so a card fits its column and its frame sets the size instead. */
  posterFloor?: boolean;
  /** Label every nth hour on the time axis; the suggestion slides thin their labels
   * so a narrow grid keeps them apart. Defaults to every hour. */
  hourLabelStep?: number;
  /** The block fill. Edit takes the soft depth card and the poster the flat tint its export
   * captures; the plan suggestion cards, read only but never exported, ask for the soft card. */
  blockSurface?: BlockSurface;
  /** Show a block's name alone while it is narrower than 7em. On where the block width is a
   * day column, the portrait edit grid, by default; the suggestion slides ask for it, since a
   * slide track can be as narrow. Off in landscape, where a block is as wide as its meeting
   * is long, and on the poster, so an exported short meeting keeps its place (ADR-0047). */
  narrowBlocks?: boolean;
  /** Lay each block out as the phone day card, the time first and the chips at its foot.
   * Set by the day view only, where a block is the full width of the pane and tall. */
  dayCard?: boolean;
  /** Whether this grid is the poster the export rasterizes, which sets the raster line
   * height and the pinned foot. Defaults to every read only grid; the suggestion cards are
   * read only but never exported, so they pass false. */
  exported?: boolean;
}

/** The edit grid inputs that hold whatever days and layout render them, so the week grid
 * and the day view take one bundle. */
export type EditGridProps = Pick<
  WeeklyGridProps,
  | 'locale'
  | 't'
  | 'onRemove'
  | 'conflictIds'
  | 'examConflictIds'
  | 'examOverlaps'
  | 'onOpenDetail'
  | 'onContextMenu'
  | 'surfaceOpen'
>;

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
  surfaceOpen = false,
  notice,
  days = WEEK_DAYS,
  display,
  dayAccent = false,
  orientation = 'landscape',
  fontPx = EDIT_FONT_PX,
  label,
  posterFloor = true,
  hourLabelStep = 1,
  blockSurface = editable ? 'soft' : 'flat',
  narrowBlocks = editable && orientation === 'portrait',
  dayCard = false,
  exported = !editable,
}: WeeklyGridProps) {
  // The grid template follows only the window, the day count, the orientation, and the
  // mode, so it holds stable across a drag or a plan change and is computed once per those
  // inputs.
  const gridStyle = useMemo(
    () => gridTemplate(window, days.length, orientation, editable),
    [window, days, orientation, editable],
  );
  const isPortrait = orientation === 'portrait';
  const floor = !posterFloor
    ? ''
    : isPortrait
      ? 'min-h-[44rem]'
      : editable
        ? ''
        : 'min-w-[44rem]';

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
  // Leaving a block cancels a card still waiting on its delay. A card already shown closes
  // itself once the pointer leaves both the block and the card, so it stays open while the
  // pointer travels onto it.
  const handleHoverLeave = useCallback(() => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);
  const closeHoverCard = useCallback(() => {
    setHoverDetail(null);
  }, []);
  // When a detail popover pins or the context menu opens, or either closes, drop any shown
  // hover card so it never lingers over the surface and none flashes as it closes. The render
  // gate below keeps a pending hover from surfacing while one is open, and a pending timer is
  // cleared on mouse leave or replaced by the next hover, so only the shown card needs
  // clearing here. This is the render time adjust on change pattern, not an effect.
  const [prevSurfaceOpen, setPrevSurfaceOpen] = useState(surfaceOpen);
  if (surfaceOpen !== prevSurfaceOpen) {
    setPrevSurfaceOpen(surfaceOpen);
    if (hoverDetail !== null) {
      setHoverDetail(null);
    }
  }

  return (
    <div
      role="group"
      aria-label={label ?? t('grid.label')}
      // The edit grid is the landing point when a remove leaves no block to focus, so it
      // takes programmatic focus, though it is not a tab stop.
      data-edit-grid={editable ? '' : undefined}
      tabIndex={editable ? -1 : undefined}
      className={`grid h-full leading-normal text-ink outline-none ${floor} ${blocked ? 'cursor-not-allowed' : ''}`}
      style={{ ...gridStyle, fontSize: `${String(fontPx)}px` }}
    >
      <GridAxis
        window={window}
        orientation={orientation}
        sticky={editable}
        labelStep={hourLabelStep}
      />

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
        surface={blockSurface}
        narrowBlocks={narrowBlocks}
        dayCard={dayCard}
        exported={exported}
      />

      <GridRules
        window={window}
        orientation={orientation}
        startEdgeDrawn={editable && orientation === 'landscape'}
      />

      {notice}

      {editable ? (
        <CandidateLayer
          sections={sections}
          window={window}
          days={days}
          orientation={orientation}
          t={t}
        />
      ) : null}

      {editable && active === null && !surfaceOpen && hoverDetail !== null ? (
        <BlockHoverCard
          // One card per block, so a card replaced by the next hover drops the close
          // tracking it started for the block before.
          key={hoverDetail.teachTableId}
          teachTableId={hoverDetail.teachTableId}
          anchor={hoverDetail.anchor}
          locale={locale}
          t={t}
          examOverlaps={examOverlaps?.get(hoverDetail.teachTableId) ?? []}
          onClose={closeHoverCard}
        />
      ) : null}
    </div>
  );
}
