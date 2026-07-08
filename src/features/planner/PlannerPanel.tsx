// The planner region: the weekly timetable rendered from the plan snapshots. It
// reads the plan entries, reshapes them into placed sections, and derives the
// visible time window from the scheduled meetings so an early or late class widens
// the grid. Unscheduled sections and the footer summary arrive with the shelf.

import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import { computeWindow } from '@/lib/planner/grid';
import { planStore } from '@/features/plans/planStore';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { isScheduled, toPlacedSection } from './placedSection';
import { dragStore } from './dragStore';
import { FeedbackStrip } from './FeedbackStrip';
import { GridFooter } from './GridFooter';
import { PosterHeader } from './PosterHeader';
import { UnscheduledShelf } from './UnscheduledShelf';
import { WeeklyGrid } from './WeeklyGrid';

export function PlannerPanel() {
  const { t, language } = useTranslation();
  const entries = useStore(planStore, (state) => state.entries);
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const activeDrag = useStore(dragStore, (state) => state.active);

  const sections = useMemo(
    () => entries.map((entry) => toPlacedSection(entry.snapshot)),
    [entries],
  );
  const scheduled = useMemo(() => sections.filter(isScheduled), [sections]);
  const unscheduled = useMemo(
    () => sections.filter((section) => !isScheduled(section)),
    [sections],
  );
  const window = useMemo(() => {
    const placedMeetings = scheduled.flatMap((section) => section.meetings);
    const dragMeetings =
      activeDrag === null
        ? []
        : activeDrag.group.flatMap((section) => section.meetings);
    return computeWindow([...placedMeetings, ...dragMeetings]);
  }, [scheduled, activeDrag]);
  const handleRemove = useCallback((teachTableId: string) => {
    planStore.getState().remove(teachTableId);
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      {viewMode === 'preview' ? (
        <PosterHeader
          planName={t('plan.untitled')}
          sections={sections}
          locale={language}
          t={t}
        />
      ) : null}
      {viewMode === 'edit' ? <FeedbackStrip locale={language} t={t} /> : null}
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
      {unscheduled.length > 0 ? (
        <UnscheduledShelf
          sections={unscheduled}
          locale={language}
          t={t}
          onRemove={viewMode === 'edit' ? handleRemove : undefined}
        />
      ) : null}
      {sections.length > 0 ? <GridFooter sections={sections} t={t} /> : null}
    </div>
  );
}
