// The narrow timetable of ADR-0049: one day at a time under a row of day chips. The chips
// keep the shape of the week in view, and below them the edit grid renders in portrait
// with the one shown day as its only column, so the time runs down the scroller and each
// block takes the full width. The window is the edit frame's smart window, so a drag holds
// it as it does on the week. Blocks stay the same drag sources with the same detail and
// context menu, and a day with no class says so with the day name.
//
// Until the student picks a day, the view follows the first day with a class, so a class
// added from the catalog pane is in view on return; a picked day holds until its chip
// leaves the row.
//
// A horizontal swipe over the timetable steps the day, stopping at either end of the row.
// It starts only past 24 px along the row and never while a drag is live. A touch drag
// waits for a finger held within 8 px, so a finger that has travelled 24 px has already
// released any pending long press, and a block keeps its tap and its long press. The chips
// stay the path every input reaches. Under reduced motion the swipe still steps the day,
// but the column does not follow the finger.

import { useMemo, useState } from 'react';
import { fillTemplate } from '@/lib/i18n/template';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import type { ConflictDetail } from '@/lib/planner/placement';
import {
  dayChipDays,
  dayFlags,
  shownDay,
  stepDay,
} from '@/lib/planner/dayView';
import { usePrefersReducedMotion } from '@/features/shell/usePresence';
import {
  useSwipeGesture,
  type SwipeDirection,
} from '@/features/shell/useSwipeGesture';
import { dragStore, selectDragging } from './dragStore';
import { DayChips } from './DayChips';
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
  /** The time conflicts among the placed sections, which mark their days. */
  timeConflicts: ReadonlyMap<string, readonly ConflictDetail[]>;
  /** Whether the plan holds no section at all, scheduled or not. */
  planEmpty: boolean;
  grid: EditGridProps;
}

export function DayView({
  sections,
  window,
  timeConflicts,
  planEmpty,
  grid,
}: DayViewProps) {
  const { t } = grid;
  const meetings = useMemo(
    () => sections.flatMap((section) => section.meetings),
    [sections],
  );
  const days = useMemo(() => dayChipDays(meetings), [meetings]);
  const flags = useMemo(
    () => dayFlags(meetings, timeConflicts),
    [meetings, timeConflicts],
  );
  const [chosen, setChosen] = useState<DayOfWeek | null>(null);
  const day = shownDay(days, chosen, flags);
  const run = useMemo(() => [day], [day]);
  const dayName = t(dayFullLabelKey(day));
  const reducedMotion = usePrefersReducedMotion();
  // A finger that travels left brings the next day in from the right.
  const { handlers, style, touchClass, bindClaim } = useSwipeGesture({
    axis: 'x',
    slop: SWIPE_SLOP_PX,
    canStart: noDragLive,
    onSwipe: (direction: SwipeDirection) => {
      setChosen(stepDay(days, day, direction === 1 ? -1 : 1, false));
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <DayChips
        days={days}
        selected={day}
        flags={flags}
        onSelect={setChosen}
        t={t}
      />
      <div
        {...handlers}
        ref={bindClaim}
        data-day-swipe
        className={`flex min-h-0 flex-1 flex-col ${touchClass}`}
        style={reducedMotion ? undefined : style}
      >
        <GridScroller>
          {(fontPx) => (
            <>
              <WeeklyGrid
                {...grid}
                sections={sections}
                window={window}
                days={run}
                orientation="portrait"
                editable
                fontPx={fontPx}
                label={fillTemplate(t('view.dayGrid'), { day: dayName })}
              />
              {planEmpty ? (
                <GridEmptyState t={t} />
              ) : flags[day].hasClass ? null : (
                <FreeDayNotice dayName={dayName} t={t} />
              )}
            </>
          )}
        </GridScroller>
      </div>
    </div>
  );
}
