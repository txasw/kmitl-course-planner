// The planner region: the weekly timetable rendered from the plan snapshots. It
// reads the plan entries, reshapes them into placed sections, and derives the
// visible time window from the scheduled meetings so an early or late class widens
// the grid. Unscheduled sections and the footer summary arrive with the shelf.

import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useStore } from 'zustand';
import { snapshotToSection } from '@/lib/domain/plan';
import {
  computeSmartWindow,
  computeWindow,
  smartVisibleDays,
} from '@/lib/planner/grid';
import { templateBySlug } from '@/lib/planner/exportTemplates';
import { planConflicts } from '@/lib/planner/planConflicts';
import { planExamConflicts } from '@/lib/planner/examOverlap';
import { planStore, useActivePlan } from '@/features/plans/planStore';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { isScheduled, toPlacedSection } from './placedSection';
import { dragStore } from './dragStore';
import { BlockDetailPopover } from './BlockDetailPopover';
import { BlockContextMenu } from './BlockContextMenu';
import { FeedbackStrip } from './FeedbackStrip';
import { GridEmptyState } from './GridEmptyState';
import { GridFooter } from './GridFooter';
import { type PosterData } from './PreviewPoster';
import { PreviewToolbar } from './PreviewToolbar';
import { RevalidationBanner } from './RevalidationBanner';
import { TemplateGallery } from './TemplateGallery';
import { UnscheduledShelf } from './UnscheduledShelf';
import { WeeklyGrid } from './WeeklyGrid';

export function PlannerPanel() {
  const { t, language } = useTranslation();
  const entries = useStore(planStore, (state) => state.entries);
  const activePlan = useActivePlan();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const displayOptions = useStore(uiStore, (state) => state.displayOptions);
  const selectedTemplate = useStore(uiStore, (state) => state.selectedTemplate);
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
  // revalidation exam change re-evaluates the conflicts the way a time change re-lights
  // the time conflicts. The full map feeds the block popover; its keys drive the danger
  // badge, since an exam overlap discovered among placed entries is a hard conflict.
  const examConflicts = useMemo(
    () =>
      planExamConflicts(
        entries.map((entry) => snapshotToSection(entry.snapshot)),
      ),
    [entries],
  );
  const examConflictIds = useMemo(
    () => new Set(examConflicts.keys()),
    [examConflicts],
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
  // The template poster window and day run: the 08:00 to 18:00 working day extended for
  // outliers, and Monday to Friday extended for weekend meetings. Both are derived
  // unconditionally and only used in preview, superseding the fit to content window logic
  // for templates (precedence: template canvas, then this smart window, then display
  // options). Edit mode keeps the extending window above.
  const scheduledMeetings = useMemo(
    () => scheduled.flatMap((section) => section.meetings),
    [scheduled],
  );
  const smartWindow = useMemo(
    () => computeSmartWindow(scheduledMeetings),
    [scheduledMeetings],
  );
  const smartDays = useMemo(
    () => smartVisibleDays(scheduledMeetings),
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
  const [contextMenu, setContextMenu] = useState<{
    teachTableId: string;
    anchor: HTMLElement;
    x: number;
    y: number;
  } | null>(null);
  const openContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    const anchor = event.currentTarget;
    const teachTableId = anchor.dataset.teachTableId;
    if (teachTableId !== undefined) {
      // Replace the browser menu only on a block, and only in edit mode.
      event.preventDefault();
      setContextMenu({
        teachTableId,
        anchor,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }, []);
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
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
      setContextMenu(null);
    }
  }
  // The poster subtree the sharing actions capture. It holds the header, grid,
  // shelf, and footer but not the toolbar or the revalidation banner, so a shared
  // image carries the plan and not the surrounding chrome.
  const posterRef = useRef<HTMLDivElement>(null);
  const isPreview = viewMode === 'preview';
  const template = templateBySlug(selectedTemplate);
  // The template independent poster inputs, bundled once so the gallery renders the selected
  // poster and its peeking neighbors from one plan snapshot and can defer the neighbors.
  const posterData = useMemo<PosterData>(
    () => ({
      planName: activePlan?.name ?? t('plan.untitled'),
      term:
        activePlan === null
          ? null
          : { year: activePlan.year, semester: activePlan.semester },
      sections,
      scheduled,
      unscheduled,
      window: smartWindow,
      days: smartDays,
      displayOptions,
      conflictIds,
      examConflictIds,
      examOverlaps: examConflicts,
      locale: language,
      t,
    }),
    [
      activePlan,
      sections,
      scheduled,
      unscheduled,
      smartWindow,
      smartDays,
      displayOptions,
      conflictIds,
      examConflictIds,
      examConflicts,
      language,
      t,
    ],
  );

  return (
    <div className="flex h-full flex-col gap-2">
      {isPreview ? (
        <PreviewToolbar
          posterRef={posterRef}
          template={template}
          sections={sections}
          displayOptions={displayOptions}
        />
      ) : null}
      {viewMode === 'edit' ? <FeedbackStrip t={t} /> : null}
      <RevalidationBanner />
      {isPreview ? (
        <TemplateGallery poster={posterData} posterRef={posterRef} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="relative min-h-0 flex-1 overflow-auto kcp-scroll">
            <WeeklyGrid
              sections={scheduled}
              window={window}
              locale={language}
              t={t}
              editable
              onRemove={handleRemove}
              conflictIds={conflictIds}
              examConflictIds={examConflictIds}
              examOverlaps={examConflicts}
              onOpenDetail={openDetail}
              onContextMenu={openContextMenu}
              detailOpen={detail !== null}
            />
            {sections.length === 0 ? <GridEmptyState t={t} /> : null}
          </div>
          {unscheduled.length > 0 ? (
            <UnscheduledShelf
              sections={unscheduled}
              locale={language}
              t={t}
              onRemove={handleRemove}
              examConflictIds={examConflictIds}
            />
          ) : null}
          {sections.length > 0 ? (
            <GridFooter sections={sections} t={t} />
          ) : null}
        </div>
      )}
      {viewMode === 'edit' && detail !== null ? (
        <BlockDetailPopover
          teachTableId={detail.teachTableId}
          anchor={detail.anchor}
          locale={language}
          t={t}
          onClose={closeDetail}
          onRemove={handleRemove}
          examOverlaps={examConflicts.get(detail.teachTableId) ?? []}
        />
      ) : null}
      {viewMode === 'edit' && contextMenu !== null ? (
        <BlockContextMenu
          teachTableId={contextMenu.teachTableId}
          x={contextMenu.x}
          y={contextMenu.y}
          t={t}
          onClose={closeContextMenu}
          onRemove={(id) => {
            handleRemove(id);
            closeContextMenu();
          }}
          onDetails={() => {
            openDetail(contextMenu.anchor);
            closeContextMenu();
          }}
        />
      ) : null}
    </div>
  );
}
