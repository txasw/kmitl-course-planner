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

import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { fillTemplate } from '@/lib/i18n/template';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import type { ConflictDetail } from '@/lib/planner/placement';
import { dayChipDays, dayFlags, shownDay } from '@/lib/planner/dayView';
import { DayChips } from './DayChips';
import { GridEmptyState } from './GridEmptyState';
import { GridScroller } from './GridScroller';
import type { PlacedSection } from './placedSection';
import { WeeklyGrid, type EditGridProps } from './WeeklyGrid';

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <DayChips
        days={days}
        selected={day}
        flags={flags}
        onSelect={setChosen}
        t={t}
      />
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
              <div
                data-free-day
                className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 px-6 text-center"
              >
                <CalendarCheck
                  size={28}
                  strokeWidth={1.75}
                  className="text-ink-soft"
                  aria-hidden
                />
                <p className="text-sm font-semibold text-ink">{dayName}</p>
                <p className="text-sm text-ink-soft">{t('view.freeDay')}</p>
              </div>
            )}
          </>
        )}
      </GridScroller>
    </div>
  );
}
