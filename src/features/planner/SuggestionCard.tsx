// One suggested timetable, one slide of the suggestion carousel. Its heading row names the
// option and carries the apply action, which creates a new plan from it, so the action is
// in view with the start of the slide on a phone's first screen (ADR-0054 amendment of
// 2026-11-21). Below it the slide shows the whole week the suggestion would produce, the
// plan subjects it keeps included, as a read only mini grid in the frame the dialog shares
// across the slides, then the stats a student compares suggestions by, then the sections it
// places named in full, then the ticked courses it leaves out with the reason each one
// stayed out, both lists collapsed by default behind the system chevron disclosure.
// The grid itself takes no input; the placed list is where a name the grid clamps reads
// whole. The carousel keeps a drag from selecting text, so both lists opt back in and their
// names can be copied.
//
// A slide takes the full width of the dialog, so the grid is drawn large enough to read in
// place, in the orientation the dialog picks for the tier, and fits its box rather than
// keeping the poster floor, so no meeting sits out of view. Each stat value sits right
// after its own label, in two columns on a phone and three from the small breakpoint, so a
// wide dialog never pushes a value across to the next label; a label wraps rather than
// cuts.

import { useId, useRef } from 'react';
import { Disclosure } from '@/components/Disclosure';
import { useElementSize } from '@/features/shell/useElementSize';
import { hourTicks } from '@/lib/planner/grid';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { formatMinutes } from '@/lib/parsing/time';
import { hoursText } from '@/lib/i18n/hours';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { LeftOutCourse, Suggestion } from '@/lib/planner/suggest';
import type { LeftOutReason } from '@/lib/planner/suggestReasons';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import type { Orientation } from './gridGeometry';
import { isScheduled, type PlacedSection } from './placedSection';
import type { SuggestionFrame } from './suggestionFrame';
import { WeeklyGrid } from './WeeklyGrid';

/** The mini grid labels each block by its name and section in the panel language; the room
 * stays out. */
const MINI_DISPLAY: DisplayOptions = {
  showRoom: false,
  showSection: true,
  showSubjectId: false,
  showExams: false,
};

/** The mini grid type size, in px. The narrow block rule is in em of it, so a larger size
 * would put more of a phone's day columns past the width a Thai word needs. */
const GRID_FONT_PX = 10;

// The grid box height per orientation. Portrait runs time downward on a phone, so it needs
// the taller box; landscape rows share the shorter one across the dialog width.
const GRID_HEIGHT: Record<Orientation, string> = {
  portrait: 'h-[30rem]',
  landscape: 'h-80',
};

// The card a slide takes on the wider tiers: the quiet soft card of ADR-0071, the one
// neutral card the panel draws. A portrait slide, on a phone, gives that width to its day
// columns instead, so a Thai word fits a 360 px screen's column whole; the sheet edge and
// the carousel frame it there.
const CARD_CHROME = 'kcp-soft-card kcp-soft-quiet p-3';

// A portrait slide has no inline padding, so the heading row insets itself by the width the
// apply action's offset focus outline draws, and the carousel clip never cuts the outline.
const HEADING_INSET = 'px-1';

// The space an hour label needs along the time axis at the mini grid type size, and the
// leading day track a landscape grid gives up before the hours begin.
const LABEL_SPAN_PX = 40;
const DAY_TRACK_PX = 36;

/** The hour label step that keeps the labels of a landscape grid this wide apart. */
export function labelStepFor(widthPx: number, hours: number): number {
  const hourPx = (widthPx - DAY_TRACK_PX) / hours;
  return hourPx > 0 ? Math.max(1, Math.ceil(LABEL_SPAN_PX / hourPx)) : 1;
}

const REASON_KEY: Record<LeftOutReason['kind'], TranslationKey> = {
  seats: 'suggest.reason.seats',
  exam: 'suggest.reason.exam',
  locked: 'suggest.reason.locked',
  noFit: 'suggest.reason.noFit',
};

function reasonText(reason: LeftOutReason, t: Translate): string {
  const subject = 'blocking' in reason ? reason.blocking.subjectId : '';
  return fillTemplate(t(REASON_KEY[reason.kind]), { subject });
}

function clock(minutes: number | null, t: Translate): string {
  return minutes === null ? t('suggest.stats.none') : formatMinutes(minutes);
}

const KIND_KEY: Record<PlacedSection['kind'], TranslationKey> = {
  lecture: 'section.lecture',
  practice: 'section.practice',
};

/** The sections a slide places, named in full, which also lists any section with no
 * meeting that the grid cannot draw. A name the grid clamps reads here whole, and a plan
 * subject the suggestion moves says, on its first row, which section it moves from. */
function PlacedList({
  sections,
  movedFrom,
  locale,
  t,
}: {
  sections: readonly PlacedSection[];
  movedFrom: ReadonlyMap<string, string>;
  locale: Locale;
  t: Translate;
}) {
  const subjects = new Set(sections.map((section) => section.subjectId)).size;
  const firstRows = new Set(
    sections
      .filter(
        (section, at) =>
          sections.findIndex(
            (other) => other.subjectId === section.subjectId,
          ) === at,
      )
      .map((section) => section.teachTableId),
  );
  return (
    <Disclosure label={fillTemplate(t('suggest.placed'), { count: subjects })}>
      <ul className="mt-1 flex flex-col gap-1.5 select-text">
        {sections.map((section) => (
          <li key={section.teachTableId} className="flex flex-col">
            <span className="text-ink">
              {section.subjectId}{' '}
              {locale === 'th' ? section.nameTh : section.nameEn}
            </span>
            <span className="text-ink-soft">
              {fillTemplate(t('suggest.placed.section'), {
                section: section.section,
                kind: t(KIND_KEY[section.kind]),
              })}
            </span>
            {firstRows.has(section.teachTableId) &&
            movedFrom.has(section.subjectId) ? (
              <span className="text-ink-soft">
                {fillTemplate(t('suggest.placed.movedFrom'), {
                  section: movedFrom.get(section.subjectId) ?? '',
                })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

function LeftOutList({
  leftOut,
  locale,
  t,
}: {
  leftOut: LeftOutCourse[];
  locale: Locale;
  t: Translate;
}) {
  if (leftOut.length === 0) {
    return (
      <p className="px-1 text-xs text-ink-soft">{t('suggest.leftOut.none')}</p>
    );
  }
  return (
    <Disclosure
      label={fillTemplate(t('suggest.leftOut'), { count: leftOut.length })}
    >
      <ul className="mt-1 flex flex-col gap-1.5 select-text">
        {leftOut.map(({ course, reason }) => (
          <li key={course.subjectId} className="flex flex-col">
            <span className="text-ink">
              {course.subjectId}{' '}
              {locale === 'th' ? course.nameTh : course.nameEn}
            </span>
            <span className="text-ink-soft">{reasonText(reason, t)}</span>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  /** The zero based rank of the suggestion, shown one based in its heading. */
  index: number;
  /** The sections the card draws: the locked entries plus the suggestion. */
  sections: readonly PlacedSection[];
  /** The plan's section codes of each subject the suggestion moves, by subject id. */
  movedFrom: ReadonlyMap<string, string>;
  frame: SuggestionFrame;
  orientation: Orientation;
  /** The localized slide role description, while the card is one of several slides. */
  roleDescription?: string | undefined;
  locale: Locale;
  t: Translate;
  onApply: () => void;
}

export function SuggestionCard({
  suggestion,
  index,
  sections,
  movedFrom,
  frame,
  orientation,
  roleDescription,
  locale,
  t,
  onApply,
}: SuggestionCardProps) {
  const headingId = useId();
  const gridBoxRef = useRef<HTMLDivElement>(null);
  const gridBox = useElementSize(gridBoxRef);
  // A portrait grid runs its hours down a tall box, so only a landscape one thins them.
  const hourLabelStep =
    orientation === 'landscape'
      ? labelStepFor(gridBox.width, hourTicks(frame.window).length - 1)
      : 1;

  const { stats } = suggestion;
  const facts: [TranslationKey, string][] = [
    ['suggest.stats.credits', String(stats.credits)],
    ['suggest.stats.courses', String(stats.courses)],
    ['suggest.stats.days', String(stats.days)],
    ['suggest.stats.earliest', clock(stats.earliestStartMin, t)],
    ['suggest.stats.latest', clock(stats.latestEndMin, t)],
    ['suggest.stats.idle', hoursText(stats.idleMinutes, locale, t)],
  ];

  return (
    <article
      aria-labelledby={headingId}
      aria-roledescription={roleDescription}
      className={`flex flex-col gap-3 ${orientation === 'portrait' ? '' : CARD_CHROME}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${orientation === 'portrait' ? HEADING_INSET : ''}`}
      >
        <h3 id={headingId} className="text-sm font-semibold">
          {fillTemplate(t('suggest.option'), { number: index + 1 })}
        </h3>
        <button
          type="button"
          aria-describedby={headingId}
          onClick={onApply}
          className={`rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`}
        >
          {t('suggest.apply')}
        </button>
      </div>
      <div ref={gridBoxRef} className={GRID_HEIGHT[orientation]}>
        <WeeklyGrid
          sections={sections.filter(isScheduled)}
          window={frame.window}
          days={frame.days}
          locale={locale}
          t={t}
          editable={false}
          display={MINI_DISPLAY}
          orientation={orientation}
          fontPx={GRID_FONT_PX}
          posterFloor={false}
          hourLabelStep={hourLabelStep}
          blockSurface="soft"
          narrowBlocks
          exported={false}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="text-ink-soft">{t(label)}</dt>
            <dd className="text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <PlacedList
        sections={sections}
        movedFrom={movedFrom}
        locale={locale}
        t={t}
      />
      <LeftOutList leftOut={suggestion.leftOut} locale={locale} t={t} />
    </article>
  );
}
