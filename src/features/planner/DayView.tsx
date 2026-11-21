// The narrow timetable of ADR-0049: one day at a time under the chip row the timetable view
// renders above it. The edit grid renders in portrait with the one shown day as its only
// column, so the time runs down the scroller and each block takes the full width. The window
// is the edit frame's smart window, so a drag holds it as it does on the week. Blocks stay the
// same drag sources with the same detail and context menu, and a day with no class says so
// in one line at the top of its slot. Each block is as wide as the pane and tall, so it lays
// out as the day card, the time range first and the chips at its foot, rather than the narrow
// positioned block stretched (ADR-0047 amendment of 2026-11-21); the name only rule of a
// narrow column never applies here. The timetable view resolves the shown day and passes
// it in, since the chip row above the view reads it too. Each shown day opens scrolled to
// its first class, so an afternoon class is in view on arrival.
//
// A horizontal swipe over the timetable steps the day, stopping at either end of the days; it
// never lands on the week chip. It starts only past 24 px along the row and never while a drag
// is live. A touch drag waits for a finger held within 8 px, so a finger that has travelled
// 24 px has already released any pending long press, and a block keeps its tap and its long
// press. The chips stay the path every input reaches. Under reduced motion the swipe still
// steps the day, but the column does not follow the finger.

import { useMemo } from 'react';
import { fillTemplate } from '@/lib/i18n/template';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import { stepChoice, type DayFlags } from '@/lib/planner/dayView';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import {
  useSwipeGesture,
  type SwipeDirection,
} from '@/features/shell/useSwipeGesture';
import { dragStore, selectDragging } from './dragStore';
import { FreeDayNotice, GridEmptyState } from './GridEmptyState';
import { GridScroller } from './GridScroller';
import type { PlacedSection } from './placedSection';
import { WeeklyGrid, type EditGridProps } from './WeeklyGrid';

const SWIPE_SLOP_PX = 24;

function noDragLive(): boolean {
  return !selectDragging(dragStore.getState());
}

interface DayViewProps {
  /** The scheduled placed sections. */
  sections: PlacedSection[];
  window: GridWindow;
  /** The days the chip row offers, which the swipe steps through. */
  days: readonly DayOfWeek[];
  /** The class and conflict marks of every day. */
  flags: DayFlags;
  /** The day shown, resolved by the timetable view. */
  day: DayOfWeek;
  /** Whether the plan holds no section at all, scheduled or not. */
  planEmpty: boolean;
  onChoose: (day: DayOfWeek) => void;
  /** Returns to the week, the free day notice's action. */
  onShowWeek: (control: HTMLElement) => void;
  grid: EditGridProps;
}

export function DayView({
  sections,
  window,
  days,
  flags,
  day,
  planEmpty,
  onChoose,
  onShowWeek,
  grid,
}: DayViewProps) {
  const { t } = grid;
  const run = useMemo(() => [day], [day]);
  const dayName = t(dayFullLabelKey(day));
  const reducedMotion = usePrefersReducedMotion();
  // A finger that travels left brings the next day in from the right.
  const { handlers, style, touchClass, bindClaim } = useSwipeGesture({
    axis: 'x',
    slop: SWIPE_SLOP_PX,
    canStart: noDragLive,
    onSwipe: (direction: SwipeDirection) => {
      onChoose(stepChoice(days, day, direction === 1 ? -1 : 1, false));
    },
  });

  return (
    <div
      {...handlers}
      ref={bindClaim}
      data-day-swipe
      className={`flex min-h-0 flex-1 flex-col ${touchClass}`}
      style={reducedMotion ? undefined : style}
    >
      <GridScroller revealKey={day}>
        {(fontPx) => (
          <WeeklyGrid
            {...grid}
            sections={sections}
            window={window}
            days={run}
            orientation="portrait"
            editable
            dayCard
            narrowBlocks={false}
            fontPx={fontPx}
            label={fillTemplate(t('view.dayGrid'), { day: dayName })}
            notice={
              planEmpty ? (
                <GridEmptyState t={t} searchAction />
              ) : flags[day].hasClass ? null : (
                <FreeDayNotice onShowWeek={onShowWeek} t={t} />
              )
            }
          />
        )}
      </GridScroller>
    </div>
  );
}
