// The planner region: the weekly timetable rendered from the plan snapshots. It
// reads the plan entries, reshapes them into placed sections, and derives the
// visible time window from the scheduled meetings so an early or late class widens
// the grid. Unscheduled sections and the footer summary arrive with the shelf.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { computeWindow } from '@/lib/planner/grid';
import { planStore } from '@/features/plans/planStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { isScheduled, toPlacedSection } from './placedSection';
import { WeeklyGrid } from './WeeklyGrid';

export function PlannerPanel() {
  const { t, language } = useTranslation();
  const entries = useStore(planStore, (state) => state.entries);

  const sections = useMemo(
    () => entries.map((entry) => toPlacedSection(entry.snapshot)),
    [entries],
  );
  const scheduled = useMemo(() => sections.filter(isScheduled), [sections]);
  const window = useMemo(
    () => computeWindow(scheduled.flatMap((section) => section.meetings)),
    [scheduled],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-auto kcp-scroll">
        <WeeklyGrid
          sections={scheduled}
          window={window}
          locale={language}
          t={t}
        />
        {sections.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
            <p className="text-sm font-medium text-ink">
              {t('grid.emptyTitle')}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{t('grid.emptyBody')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
