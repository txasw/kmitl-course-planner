// The planner region: the weekly timetable rendered from the plan snapshots. It
// reads the plan entries, reshapes them into placed sections, and derives the
// visible time window from the scheduled meetings so an early or late class widens
// the grid. Unscheduled sections and the footer summary arrive with the shelf.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { snapshotToSection } from '@/lib/domain/plan';
import {
  computeFitWindow,
  computeWindow,
  visibleDays,
} from '@/lib/planner/grid';
import { planConflicts } from '@/lib/planner/planConflicts';
import { planExamWarnings } from '@/lib/planner/examOverlap';
import { planStore, useActivePlan } from '@/features/plans/planStore';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { isScheduled, toPlacedSection } from './placedSection';
import { dragStore } from './dragStore';
import { BlockDetailPopover } from './BlockDetailPopover';
import { FeedbackStrip } from './FeedbackStrip';
import { GridFooter } from './GridFooter';
import { PosterHeader } from './PosterHeader';
import { PreviewToolbar } from './PreviewToolbar';
import { RevalidationBanner } from './RevalidationBanner';
import { UnscheduledShelf } from './UnscheduledShelf';
import { WeeklyGrid } from './WeeklyGrid';

export function PlannerPanel() {
  const { t, language } = useTranslation();
  const entries = useStore(planStore, (state) => state.entries);
  const activePlan = useActivePlan();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const displayOptions = useStore(uiStore, (state) => state.displayOptions);
  const activeDrag = useStore(dragStore, (state) => state.active);
  const hoverSection = useStore(dragStore, (state) => state.hover);
  const courseDrag = useStore(dragStore, (state) => state.courseDrag);
  const blockMove = useStore(dragStore, (state) => state.blockMove);

  const sections = useMemo(
    () =>
      entries.map((entry) =>
        toPlacedSection(entry.snapshot, entry.verifyStatus),
      ),
    [entries],
  );
  // teachTableIds a time change put into a new conflict, computed from the full
  // sections so declared pairs are excluded correctly.
  const conflictIds = useMemo(
    () =>
      new Set(
        planConflicts(
          entries.map((entry) => snapshotToSection(entry.snapshot)),
        ).keys(),
      ),
    [entries],
  );
  // Exam window overlaps keyed by teachTableId, derived from the same entries so a
  // revalidation exam change re-evaluates the warnings the way a time change re-lights
  // the conflicts. The full map feeds the block popover; its keys drive the warn badge.
  const examWarnings = useMemo(
    () =>
      planExamWarnings(
        entries.map((entry) => snapshotToSection(entry.snapshot)),
      ),
    [entries],
  );
  const examWarnIds = useMemo(
    () => new Set(examWarnings.keys()),
    [examWarnings],
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
    const hoverMeetings = hoverSection === null ? [] : hoverSection.meetings;
    const courseMeetings =
      courseDrag === null
        ? []
        : courseDrag.candidates.flatMap((candidate) =>
            candidate.group.flatMap((section) => section.meetings),
          );
    const blockMoveMeetings =
      blockMove === null
        ? []
        : [
            ...blockMove.group.flatMap((section) => section.meetings),
            ...blockMove.candidates.flatMap((candidate) =>
              candidate.group.flatMap((section) => section.meetings),
            ),
          ];
    return computeWindow([
      ...placedMeetings,
      ...dragMeetings,
      ...hoverMeetings,
      ...courseMeetings,
      ...blockMoveMeetings,
    ]);
  }, [scheduled, activeDrag, hoverSection, courseDrag, blockMove]);
  // The fit to content preview trims the window and day rows to the scheduled
  // meetings. Both are derived unconditionally and only used when preview and the
  // option are on, so switching the option in place needs no extra state.
  const scheduledMeetings = useMemo(
    () => scheduled.flatMap((section) => section.meetings),
    [scheduled],
  );
  const fitWindow = useMemo(
    () => computeFitWindow(scheduledMeetings),
    [scheduledMeetings],
  );
  const fitDays = useMemo(
    () => visibleDays(scheduledMeetings),
    [scheduledMeetings],
  );
  const handleRemove = useCallback((teachTableId: string) => {
    planStore.getState().remove(teachTableId);
  }, []);
  const [detail, setDetail] = useState<{
    teachTableId: string;
    anchor: HTMLElement;
  } | null>(null);
  const openDetail = useCallback((anchor: HTMLElement) => {
    const teachTableId = anchor.dataset.teachTableId;
    if (teachTableId !== undefined) {
      setDetail({ teachTableId, anchor });
    }
  }, []);
  const closeDetail = useCallback(() => {
    setDetail(null);
  }, []);
  // The anchor is a live block node. Switching to preview recreates the blocks, so a
  // popover left open would point at a detached node on return to edit. Clear it as
  // the panel leaves edit mode, using the render time adjust on change pattern rather
  // than an effect.
  const [lastMode, setLastMode] = useState(viewMode);
  if (viewMode !== lastMode) {
    setLastMode(viewMode);
    if (viewMode !== 'edit') {
      setDetail(null);
    }
  }
  // The poster subtree the sharing actions capture. It holds the header, grid,
  // shelf, and footer but not the toolbar or the revalidation banner, so a shared
  // image carries the plan and not the surrounding chrome.
  const posterRef = useRef<HTMLDivElement>(null);
  const isPreview = viewMode === 'preview';
  const fitActive = isPreview && displayOptions.fitToContent;

  return (
    <div className="flex h-full flex-col gap-2">
      {isPreview ? (
        <PreviewToolbar
          posterRef={posterRef}
          sections={sections}
          displayOptions={displayOptions}
        />
      ) : null}
      {viewMode === 'edit' ? <FeedbackStrip locale={language} t={t} /> : null}
      <RevalidationBanner />
      <div
        ref={posterRef}
        className={`flex min-h-0 flex-1 flex-col gap-2 ${
          isPreview ? 'rounded-kcp bg-surface p-3' : ''
        }`}
      >
        {isPreview ? (
          <PosterHeader
            planName={activePlan?.name ?? t('plan.untitled')}
            term={
              activePlan === null
                ? null
                : { year: activePlan.year, semester: activePlan.semester }
            }
            sections={sections}
            locale={language}
            t={t}
          />
        ) : null}
        <div className="relative min-h-0 flex-1 overflow-auto kcp-scroll">
          <WeeklyGrid
            sections={scheduled}
            window={fitActive ? fitWindow : window}
            locale={language}
            t={t}
            editable={viewMode === 'edit'}
            onRemove={handleRemove}
            conflictIds={conflictIds}
            examWarnIds={examWarnIds}
            onOpenDetail={openDetail}
            {...(fitActive ? { days: fitDays } : {})}
            {...(isPreview ? { display: displayOptions } : {})}
          />
          {sections.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
              <p className="text-sm font-medium text-ink">
                {t('grid.emptyTitle')}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {t('grid.emptyBody')}
              </p>
            </div>
          ) : null}
        </div>
        {unscheduled.length > 0 ? (
          <UnscheduledShelf
            sections={unscheduled}
            locale={language}
            t={t}
            onRemove={viewMode === 'edit' ? handleRemove : undefined}
            examWarnIds={examWarnIds}
            {...(isPreview
              ? {
                  showSection: displayOptions.showSection,
                  showEnglishName: displayOptions.showEnglishNames,
                }
              : {})}
          />
        ) : null}
        {sections.length > 0 ? <GridFooter sections={sections} t={t} /> : null}
      </div>
      {viewMode === 'edit' && detail !== null ? (
        <BlockDetailPopover
          teachTableId={detail.teachTableId}
          anchor={detail.anchor}
          locale={language}
          t={t}
          onClose={closeDetail}
          onRemove={handleRemove}
        />
      ) : null}
    </div>
  );
}
