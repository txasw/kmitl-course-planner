// The edit timetable, which picks its layout by the room it has (ADR-0049). It measures its
// own box rather than the viewport, so a grid scroller narrower than 640 px is narrow and a
// wider one shows the landscape week. A narrow timetable heads itself with one chip row: a
// week chip and a chip per teaching day. A day chip shows the day view, the default, which
// reads one day at a time, and the week chip renders the edit grid in portrait, days as
// columns over the same smart frame and measured fit as the landscape week. The row stays in
// place for both, so the student switches between a day and the week in one tap. The measure
// lives here, in the component that mounts with the timetable, so switching back from the
// selected courses view starts a fresh observation of the new node. The day the day view
// shows is held by the planner panel and passed through; until the student picks one, it
// follows the first day with a class, and a picked day holds until its chip leaves the row.

import { useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridFrame } from '@/lib/planner/grid';
import type { ConflictDetail } from '@/lib/planner/placement';
import {
  dayChipDays,
  dayFlags,
  isDayViewWidth,
  shownDay,
  type TimetableChoice,
} from '@/lib/planner/dayView';
import { useElementSize } from '@/features/shell/useElementSize';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { uiStore } from '@/features/shell/uiStore';
import { DayChips } from './DayChips';
import { DayView } from './DayView';
import { GridEmptyState } from './GridEmptyState';
import { GridScroller } from './GridScroller';
import type { PlacedSection } from './placedSection';
import { WeeklyGrid, type EditGridProps } from './WeeklyGrid';

interface TimetableViewProps {
  /** The scheduled placed sections. */
  sections: PlacedSection[];
  frame: GridFrame;
  timeConflicts: ReadonlyMap<string, readonly ConflictDetail[]>;
  /** Whether the plan holds no section at all, scheduled or not. */
  planEmpty: boolean;
  /** The day the day view shows when the student picked one, or null. */
  day: DayOfWeek | null;
  onDayChange: (day: DayOfWeek) => void;
  grid: EditGridProps;
}

export function TimetableView({
  sections,
  frame,
  timeConflicts,
  planEmpty,
  day,
  onDayChange,
  grid,
}: TimetableViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementSize(rootRef).width;
  const compact = useLayoutTier() === 'compact';
  const narrow = isDayViewWidth(width, compact);
  const view = useStore(uiStore, (state) => state.timetableView);
  const setView = useStore(uiStore, (state) => state.setTimetableView);
  const meetings = useMemo(
    () => sections.flatMap((section) => section.meetings),
    [sections],
  );
  const days = useMemo(() => dayChipDays(meetings), [meetings]);
  const flags = useMemo(
    () => dayFlags(meetings, timeConflicts),
    [meetings, timeConflicts],
  );
  const shown = shownDay(days, day, flags);
  const handleChoose = (choice: TimetableChoice) => {
    if (choice === 'week') {
      setView('week');
      return;
    }
    setView('day');
    onDayChange(choice);
  };

  return (
    <div
      ref={rootRef}
      className={`flex min-h-0 flex-1 flex-col ${narrow ? 'gap-2' : ''}`}
    >
      {narrow ? (
        <DayChips
          days={days}
          selected={view === 'week' ? 'week' : shown}
          flags={flags}
          onSelect={handleChoose}
          t={grid.t}
        />
      ) : null}
      {narrow && view === 'day' ? (
        <DayView
          sections={sections}
          window={frame.window}
          days={days}
          flags={flags}
          day={shown}
          planEmpty={planEmpty}
          onChoose={onDayChange}
          grid={grid}
        />
      ) : (
        <GridScroller>
          {(fontPx) => (
            <WeeklyGrid
              {...grid}
              sections={sections}
              window={frame.window}
              days={frame.days}
              orientation={narrow ? 'portrait' : 'landscape'}
              editable
              fontPx={fontPx}
              notice={
                planEmpty ? <GridEmptyState t={grid.t} searchAction /> : null
              }
            />
          )}
        </GridScroller>
      )}
    </div>
  );
}
