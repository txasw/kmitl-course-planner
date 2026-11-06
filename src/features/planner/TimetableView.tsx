// The edit timetable, which picks its layout by the room it has (ADR-0049). It measures its
// own box rather than the viewport, so a grid scroller narrower than 640 px reads one day
// at a time through the day view, and a wider one shows the landscape week. The measure
// lives here, in the component that mounts with the timetable, so switching back from the
// selected courses view starts a fresh observation of the new node.

import { useRef } from 'react';
import type { GridFrame } from '@/lib/planner/grid';
import type { ConflictDetail } from '@/lib/planner/placement';
import { isDayViewWidth } from '@/lib/planner/dayView';
import { useElementSize } from '@/features/shell/useElementSize';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
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
  grid: EditGridProps;
}

export function TimetableView({
  sections,
  frame,
  timeConflicts,
  planEmpty,
  grid,
}: TimetableViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementSize(rootRef).width;
  const compact = useLayoutTier() === 'compact';
  const dayView = isDayViewWidth(width, compact);

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      {dayView ? (
        <DayView
          sections={sections}
          window={frame.window}
          timeConflicts={timeConflicts}
          planEmpty={planEmpty}
          grid={grid}
        />
      ) : (
        <GridScroller>
          {(fontPx) => (
            <>
              <WeeklyGrid
                {...grid}
                sections={sections}
                window={frame.window}
                days={frame.days}
                editable
                fontPx={fontPx}
              />
              {planEmpty ? <GridEmptyState t={grid.t} /> : null}
            </>
          )}
        </GridScroller>
      )}
    </div>
  );
}
