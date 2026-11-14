// One preview poster, the shareable composition for a single export template: the header,
// the weekly grid, the unscheduled shelf, the exam schedule when the display option asks for
// it (ADR-0064), the footer summary, the data date, and the watermark, laid out at the
// template's exact layout box and type scale. It is read only, never editable, so it carries
// no drag or remove wiring, and no verification or conflict marks: those are editing signals
// the people who receive the image cannot act on, so the footer states them as text instead
// (ADR-0055). The template gallery renders one of these per visible template; only the
// selected one holds the capture ref, which html-to-image reads at the poster's own box so
// the export lands the exact template pixels regardless of the display scale around it
// (ADR-0041, ADR-0045). The poster carries no frame of its own: the gallery's scaled
// wrapper draws the border, corner, and shadow, so none of them reach the export. Memoized
// so paging between templates and a display option change re-render at most the posters
// whose inputs moved.

import { memo, type RefObject } from 'react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { DayOfWeek } from '@/lib/parsing/days';
import type { GridWindow } from '@/lib/planner/grid';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { ExamSchedule } from '@/lib/planner/examSchedule';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import type { PosterHonesty } from '@/lib/planner/posterHonesty';
import { GridEmptyState } from './GridEmptyState';
import { PosterDataLine } from './PosterDataLine';
import { PosterExamBlock } from './PosterExamBlock';
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
  /** The data date, missing count, and conflicting pair count the footer states as text. */
  honesty: PosterHonesty;
  /** The plan's exam schedule, which the poster lists when the show exams option is on. */
  examSchedule: ExamSchedule;
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
  honesty,
  examSchedule,
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
      className="kcp-poster flex flex-col gap-2 bg-surface p-3"
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
          showVerification={false}
        />
      ) : null}
      {displayOptions.showExams && sections.length > 0 ? (
        <PosterExamBlock
          schedule={examSchedule}
          template={template}
          displayOptions={displayOptions}
          locale={locale}
          t={t}
        />
      ) : null}
      {/* The honesty footer is one baseline row inside the poster's equal margins: the credits
          summary flush left, the data date and the watermark flush right, sharing a baseline
          and a top divider. An empty plan has no data to date, so it carries no data line. */}
      <div
        data-poster-footer
        className="flex shrink-0 items-baseline justify-between gap-3 border-t border-border pt-2"
      >
        {sections.length > 0 ? (
          <GridFooter sections={sections} t={t} />
        ) : (
          <span />
        )}
        <div className="flex min-w-0 items-baseline justify-end gap-3">
          {sections.length > 0 ? (
            <PosterDataLine honesty={honesty} t={t} />
          ) : null}
          <PosterWatermark t={t} />
        </div>
      </div>
    </div>
  );
}

export const PreviewPoster = memo(PreviewPosterComponent);
