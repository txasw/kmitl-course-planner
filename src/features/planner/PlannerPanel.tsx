// The planner region: the weekly timetable rendered from the plan snapshots. It
// reads the plan entries, reshapes them into placed sections, and derives the
// visible time window from the scheduled meetings and the current catalog result so
// an early or late class widens the grid. Unscheduled sections and the footer
// summary arrive with the shelf. In edit mode the plan view of ADR-0049 switches the
// region between the timetable, the selected courses list, and the summary: through the
// tabs above the region on the medium and wide tiers, and through the bottom nav below
// 640 px, where the region carries no tabs and so no tabpanel semantics. A timetable
// narrower than 640 px reads one day at a time through the day view.

import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useStore } from 'zustand';
import { snapshotToSection } from '@/lib/domain/plan';
import { catalogMeetings } from '@/lib/catalog/catalogMeetings';
import {
  computeSmartWindow,
  editWindow,
  smartVisibleDays,
} from '@/lib/planner/grid';
import { templateBySlug } from '@/lib/planner/exportTemplates';
import { isDockedTier } from '@/lib/ui/breakpoints';
import { planConflicts } from '@/lib/planner/planConflicts';
import { planExamConflicts } from '@/lib/planner/examOverlap';
import { buildExamSchedule } from '@/lib/planner/examSchedule';
import { posterHonesty } from '@/lib/planner/posterHonesty';
import { planStore, useActivePlan } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { UpdatesDialog } from '@/features/plans/UpdatesDialog';
import { UpdatesIndicator } from '@/features/plans/UpdatesIndicator';
import { searchStore } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import { removalOrder, targetsAfterRemoval } from './blockFocus';
import { isScheduled, toPlacedSection } from './placedSection';
import { dragStore, selectDragging } from './dragStore';
import { BlockDetailSurface } from './BlockDetailSurface';
import { BlockContextMenu } from './BlockContextMenu';
import { FeedbackStrip } from './FeedbackStrip';
import { GridFooter } from './GridFooter';
import { PlanViewTabs, planViewPanelId, planViewTabId } from './PlanViewTabs';
import { type PosterData } from './PreviewPoster';
import { PreviewToolbar } from './PreviewToolbar';
import { RevalidationBanner } from './RevalidationBanner';
import { SummaryView } from './SummaryView';
import {
  SelectedCoursesList,
  groupEntriesBySubject,
} from './SelectedCoursesList';
import { TemplateGallery } from './TemplateGallery';
import { TimetableView } from './TimetableView';
import { UnscheduledShelf } from './UnscheduledShelf';

export function PlannerPanel() {
  const { t, language } = useTranslation();
  const entries = useStore(planStore, (state) => state.entries);
  const activePlan = useActivePlan();
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const planView = useStore(uiStore, (state) => state.planView);
  const setPlanView = useStore(uiStore, (state) => state.setPlanView);
  const tier = useLayoutTier();
  const showTabs = tier !== 'compact';
  const displayOptions = useStore(uiStore, (state) => state.displayOptions);
  // The updates dialog renders only in edit, where its actions live (ADR-0060).
  const updatesOpen = useStore(revalidationStore, (state) => state.updatesOpen);
  const closeUpdates = useCallback(() => {
    revalidationStore.getState().setUpdatesOpen(false);
  }, []);
  const selectedTemplate = useStore(uiStore, (state) => state.selectedTemplate);
  const catalogResult = useStore(searchStore, (state) => state.result);
  const frozenFrame = useStore(dragStore, (state) => state.frame);

  const sections = useMemo(
    () =>
      entries.map((entry) =>
        toPlacedSection(entry.snapshot, entry.verifyStatus),
      ),
    [entries],
  );
  // The time conflicts a time change put among the placed entries, computed from the full
  // sections so declared pairs are excluded correctly. Its keys drive the danger badge.
  const timeConflicts = useMemo(
    () =>
      planConflicts(entries.map((entry) => snapshotToSection(entry.snapshot))),
    [entries],
  );
  const conflictIds = useMemo(
    () => new Set(timeConflicts.keys()),
    [timeConflicts],
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
  // The poster carries no badges, so it states the data date, the missing count, and the
  // conflicting pair count as footer text instead (ADR-0055).
  const honesty = useMemo(
    () => posterHonesty({ entries, timeConflicts, examConflicts }),
    [entries, timeConflicts, examConflicts],
  );
  // The exam schedule the summary view lists, and the poster and the text export list when
  // the show exams option is on (ADR-0064).
  const examSchedule = useMemo(() => buildExamSchedule(entries), [entries]);
  const subjectGroups = useMemo(
    () => groupEntriesBySubject(entries),
    [entries],
  );
  const scheduled = useMemo(() => sections.filter(isScheduled), [sections]);
  const unscheduled = useMemo(
    () => sections.filter((section) => !isScheduled(section)),
    [sections],
  );
  const scheduledMeetings = useMemo(
    () => scheduled.flatMap((section) => section.meetings),
    [scheduled],
  );
  // The edit frame covers the placed meetings and every meeting in the current catalog
  // result, so a hovered row, a dragged section, and every candidate slot already sit
  // inside it and the grid never reflows while the student browses. Weekend rows show
  // only when one of those meetings needs them (ADR-0050).
  const offered = useMemo(
    () => catalogMeetings(catalogResult),
    [catalogResult],
  );
  const liveFrame = useMemo(
    () => editWindow(scheduledMeetings, offered),
    [scheduledMeetings, offered],
  );
  // A live drag holds the frame it started on, so a search that lands or a plan that
  // revalidates mid drag never moves the slots under the pointer.
  const frame = frozenFrame ?? liveFrame;
  // The template poster window and day run: the 08:00 to 18:00 working day extended for
  // outliers, and Monday to Friday extended for weekend meetings, over the placed meetings
  // only. Both are derived unconditionally and only used in preview, superseding the fit to
  // content window logic for templates (precedence: template canvas, then this smart
  // window, then display options).
  const smartWindow = useMemo(
    () => computeSmartWindow(scheduledMeetings),
    [scheduledMeetings],
  );
  const smartDays = useMemo(
    () => smartVisibleDays(scheduledMeetings),
    [scheduledMeetings],
  );
  // Every remove from the grid, the shelf, the block popover, or the context menu takes
  // the pressed control with it, so focus moves on in the same commit to the next placed
  // item in time order, or the grid when none is left.
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRemove = useCallback((teachTableId: string) => {
    const scope = rootRef.current;
    const removed = scope === null ? null : removalOrder(scope, teachTableId);
    commitThenFocus(
      () => {
        planStore.getState().remove(teachTableId);
      },
      () => (scope === null ? [] : targetsAfterRemoval(scope, removed)),
    );
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
    if (selectDragging(dragStore.getState())) {
      // A held finger fires the menu event after its long press started a drag, in a
      // browser that does not name the pointer type; the drag owns the gesture.
      event.preventDefault();
      return;
    }
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
  // The anchor is a live block node. Switching to preview or to another plan view
  // unmounts the edit grid, so a popover left open would point at a detached node on
  // return. Clear it as the edit grid leaves, using the render time adjust on change
  // pattern rather than an effect.
  const gridShown = viewMode === 'edit' && planView === 'timetable';
  const [lastGridShown, setLastGridShown] = useState(gridShown);
  if (gridShown !== lastGridShown) {
    setLastGridShown(gridShown);
    if (!gridShown) {
      setDetail(null);
      setContextMenu(null);
    }
  }
  // The poster subtree the sharing actions capture. It holds the header, grid,
  // shelf, and footer but not the toolbar or the revalidation banner, so a shared
  // image carries the plan and not the surrounding chrome.
  const posterRef = useRef<HTMLDivElement>(null);
  const isPreview = viewMode === 'preview';
  // The tabpanel semantics apply only while the tabs render to name the panel.
  const panelProps = showTabs
    ? {
        role: 'tabpanel',
        id: planViewPanelId(planView),
        'aria-labelledby': planViewTabId(planView),
      }
    : {};
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
      honesty,
      examSchedule,
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
      honesty,
      examSchedule,
      language,
      t,
    ],
  );

  return (
    <div ref={rootRef} className="flex h-full flex-col gap-2">
      {isPreview ? (
        <PreviewToolbar
          posterRef={posterRef}
          template={template}
          sections={sections}
          displayOptions={displayOptions}
          examSchedule={examSchedule}
        />
      ) : null}
      {!isPreview && showTabs ? (
        <PlanViewTabs
          value={planView}
          selectedCount={subjectGroups.length}
          examClash={examSchedule.hasClash}
          onChange={setPlanView}
          t={t}
          trailing={<UpdatesIndicator />}
        />
      ) : null}
      {/* Below the dock the strip floats over the layout instead, above the sheet. */}
      {viewMode === 'edit' && isDockedTier(tier) ? (
        <FeedbackStrip t={t} />
      ) : null}
      <RevalidationBanner />
      {isPreview ? (
        <TemplateGallery poster={posterData} posterRef={posterRef} />
      ) : planView === 'summary' ? (
        <div
          {...panelProps}
          className="kcp-scroll min-h-0 flex-1 overflow-y-auto"
        >
          <SummaryView
            schedule={examSchedule}
            hasEntries={entries.length > 0}
            locale={language}
            t={t}
          />
        </div>
      ) : planView === 'selected' ? (
        <div
          {...panelProps}
          className="kcp-scroll min-h-0 flex-1 overflow-y-auto"
        >
          <SelectedCoursesList
            groups={subjectGroups}
            locale={language}
            t={t}
            onRemove={handleRemove}
            conflictIds={conflictIds}
            examConflictIds={examConflictIds}
          />
        </div>
      ) : (
        <div {...panelProps} className="flex min-h-0 flex-1 flex-col gap-2">
          <TimetableView
            sections={scheduled}
            frame={frame}
            timeConflicts={timeConflicts}
            planEmpty={sections.length === 0}
            grid={{
              locale: language,
              t,
              onRemove: handleRemove,
              conflictIds,
              examConflictIds,
              examOverlaps: examConflicts,
              onOpenDetail: openDetail,
              onContextMenu: openContextMenu,
              detailOpen: detail !== null,
            }}
          />
          {unscheduled.length > 0 ? (
            <UnscheduledShelf
              sections={unscheduled}
              locale={language}
              t={t}
              onRemove={handleRemove}
              examConflictIds={examConflictIds}
              editable
            />
          ) : null}
          {sections.length > 0 ? (
            <GridFooter sections={sections} t={t} />
          ) : null}
        </div>
      )}
      {detail !== null ? (
        <BlockDetailSurface
          teachTableId={detail.teachTableId}
          anchor={detail.anchor}
          locale={language}
          t={t}
          onClose={closeDetail}
          onRemove={handleRemove}
          examOverlaps={examConflicts.get(detail.teachTableId) ?? []}
        />
      ) : null}
      {viewMode === 'edit' && updatesOpen ? (
        <UpdatesDialog onClose={closeUpdates} />
      ) : null}
      {viewMode === 'edit' && contextMenu !== null ? (
        <BlockContextMenu
          teachTableId={contextMenu.teachTableId}
          anchor={contextMenu.anchor}
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
