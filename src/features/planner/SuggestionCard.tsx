// One suggested timetable. It shows the whole week the suggestion would produce, the
// entries already in the plan included, as a read only mini grid in the frame the dialog
// shares across the cards, then the stats a student compares suggestions by, one per row
// in a fixed order, then the curriculum courses it leaves out with the reason each one
// stayed out, collapsed by default, then the apply action, which creates a new plan from
// it. The grid itself takes no input.
//
// The card has five parts in a fixed order. Side by side, the dialog lays them on shared
// grid rows through a subgrid, so the same stat sits at the same height on every card. The
// grid fits its card rather than keeping the poster floor, in the orientation the dialog
// picks for the tier, so no meeting sits out of view.

import { useId } from 'react';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { formatHours, formatMinutes } from '@/lib/parsing/time';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { LeftOutCourse, Suggestion } from '@/lib/planner/suggest';
import type { LeftOutReason } from '@/lib/planner/suggestReasons';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import type { SwipeGesture } from '@/features/shell/useSwipeGesture';
import type { Orientation } from './gridGeometry';
import { isScheduled, type PlacedSection } from './placedSection';
import type { SuggestionFrame } from './suggestionFrame';
import { WeeklyGrid } from './WeeklyGrid';

/** The mini grid labels each block by its name and section; room and English stay out. */
const MINI_DISPLAY: DisplayOptions = {
  fitToContent: false,
  showRoom: false,
  showSection: true,
  showEnglishNames: false,
  showSubjectId: false,
  showExams: false,
};

const GRID_FONT_PX = 10;

// The grid box height per orientation. Portrait runs time downward, so it needs the
// taller box; landscape rows share the shorter one.
const GRID_HEIGHT: Record<Orientation, string> = {
  portrait: 'h-80',
  landscape: 'h-56',
};

/** The five card parts on the rows of a parent grid, for the side by side view. The list
 * item and the card inside it both take it, so the rows reach the card's parts. */
export const SUBGRID_CARD = 'row-span-5 grid grid-rows-subgrid';

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
    return <p className="text-xs text-ink-soft">{t('suggest.leftOut.none')}</p>;
  }
  return (
    <details className="text-xs">
      <summary
        className={`w-fit cursor-pointer rounded-kcp text-ink-soft hover:text-ink ${FOCUS_RING}`}
      >
        {fillTemplate(t('suggest.leftOut'), { count: leftOut.length })}
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5">
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
    </details>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  /** The zero based rank of the suggestion, shown one based in its heading. */
  index: number;
  /** The sections the card draws: the locked entries plus the suggestion. */
  sections: readonly PlacedSection[];
  frame: SuggestionFrame;
  orientation: Orientation;
  /** Lay the five parts on the rows of a parent subgrid, for the side by side view. */
  subgrid?: boolean;
  locale: Locale;
  t: Translate;
  onApply: () => void;
  /** The pager swipe, bound to the grid, which holds no control. */
  swipe?: SwipeGesture;
}

export function SuggestionCard({
  suggestion,
  index,
  sections,
  frame,
  orientation,
  subgrid = false,
  locale,
  t,
  onApply,
  swipe,
}: SuggestionCardProps) {
  const headingId = useId();

  const { stats } = suggestion;
  const facts: [TranslationKey, string][] = [
    ['suggest.stats.credits', String(stats.credits)],
    ['suggest.stats.courses', String(stats.courses)],
    ['suggest.stats.days', String(stats.days)],
    ['suggest.stats.earliest', clock(stats.earliestStartMin, t)],
    ['suggest.stats.latest', clock(stats.latestEndMin, t)],
    [
      'suggest.stats.idle',
      `${formatHours(stats.idleMinutes)} ${t('footer.hourUnit')}`,
    ],
  ];

  return (
    <article
      aria-labelledby={headingId}
      className={`rounded-kcp border border-border bg-surface p-3 ${
        subgrid ? SUBGRID_CARD : 'flex flex-col gap-3'
      }`}
      style={swipe?.style}
    >
      <div className="flex min-h-11 items-center gap-2">
        <h3
          id={headingId}
          className="min-w-0 flex-1 text-sm font-semibold outline-none"
        >
          {fillTemplate(t('suggest.option'), { number: index + 1 })}
        </h3>
      </div>
      <dl className="flex flex-col gap-0.5 text-xs">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-ink-soft">{t(label)}</dt>
            <dd className="text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div
        className={`${GRID_HEIGHT[orientation]} ${swipe?.touchClass ?? ''}`}
        {...swipe?.handlers}
      >
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
        />
      </div>
      <LeftOutList leftOut={suggestion.leftOut} locale={locale} t={t} />
      <button
        type="button"
        aria-describedby={headingId}
        onClick={onApply}
        className={`${subgrid ? 'w-full' : 'w-full sm:w-auto sm:self-end'} rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`}
      >
        {t('suggest.apply')}
      </button>
    </article>
  );
}
