// One preview poster, the shareable composition for a single export template: the header,
// the weekly grid, the unscheduled shelf, the footer summary, and the watermark, laid out at
// the template's exact layout box and type scale. It is read only, never editable, so it
// carries no drag or remove wiring. The template gallery renders one of these per visible
// template; only the selected one holds the capture ref, which html-to-image reads at the
// poster's own box so the export lands the exact template pixels regardless of the display
// scale around it (ADR-0041, ADR-0045). Memoized so paging between templates and a display
// option change re-render at most the posters whose inputs moved.

import { memo, type RefObject } from 'react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import { GridEmptyState } from './GridEmptyState';
import { PosterHeader } from './PosterHeader';
import { PosterWatermark } from './PosterWatermark';
import { GridFooter } from './GridFooter';
import { UnscheduledShelf } from './UnscheduledShelf';
import { WeeklyGrid } from './WeeklyGrid';
import type { PlacedSection } from './placedSection';

/** The template independent poster inputs the gallery bundles once and passes to every
 * visible poster, so the selected and its peeking neighbors read the same plan snapshot. */
export interface PosterData {
  planName: string;
  term: { year: string; semester: '1' | '2' | '3' } | null;
  sections: PlacedSection[];
  scheduled: PlacedSection[];
  unscheduled: PlacedSection[];
  window: GridWindow;
  days: readonly DayOfWeek[];
  displayOptions: DisplayOptions;
  conflictIds: Set<string>;
  examConflictIds: Set<string>;
  examOverlaps: Map<string, ExamOverlap[]>;
  locale: Locale;
  t: Translate;
}

interface PreviewPosterProps extends PosterData {
  template: ExportTemplate;
  /** The capture node ref, present only on the selected poster the export reads. */
  posterRef?: RefObject<HTMLDivElement | null>;
}

function PreviewPosterComponent({
  template,
  posterRef,
  planName,
  term,
  sections,
  scheduled,
  unscheduled,
  window,
  days,
  displayOptions,
  conflictIds,
  examConflictIds,
  examOverlaps,
  locale,
  t,
}: PreviewPosterProps) {
  return (
    <div
      ref={posterRef}
      style={{
        width: template.layoutWidth,
        height: template.layoutHeight,
        fontSize: `${String(template.posterFontPx)}px`,
      }}
      className="flex flex-col gap-2 rounded-kcp bg-surface p-3"
    >
      <PosterHeader
        planName={planName}
        term={term}
        sections={sections}
        locale={locale}
        t={t}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <WeeklyGrid
          sections={scheduled}
          window={window}
          locale={locale}
          t={t}
          editable={false}
          conflictIds={conflictIds}
          examConflictIds={examConflictIds}
          examOverlaps={examOverlaps}
          days={days}
          display={displayOptions}
          dayAccent
          orientation={template.orientation}
          fontPx={template.posterFontPx}
        />
        {sections.length === 0 ? <GridEmptyState t={t} /> : null}
      </div>
      {unscheduled.length > 0 ? (
        <UnscheduledShelf
          sections={unscheduled}
          locale={locale}
          t={t}
          showSection={displayOptions.showSection}
          showEnglishName={displayOptions.showEnglishNames}
          showSubjectId={displayOptions.showSubjectId}
          examConflictIds={examConflictIds}
        />
      ) : null}
      {/* The honesty footer is one baseline row inside the poster's equal margins: the credits
          summary flush left, the watermark flush right, sharing a baseline and a top divider. */}
      <div
        data-poster-footer
        className="flex shrink-0 items-baseline justify-between gap-3 border-t border-border pt-2"
      >
        {sections.length > 0 ? (
          <GridFooter sections={sections} t={t} flush />
        ) : (
          <span />
        )}
        <PosterWatermark t={t} />
      </div>
    </div>
  );
}

export const PreviewPoster = memo(PreviewPosterComponent);
