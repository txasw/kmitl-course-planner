// One suggested timetable. It shows the whole week the suggestion would produce, the
// entries already in the plan included, as a read only mini grid in the smart window of
// the poster, then the stats a student compares suggestions by, then the curriculum
// courses it leaves out with the reason each one stayed out, collapsed by default. The
// apply action creates a new plan from it; the grid itself takes no input.

import { useId, useMemo } from 'react';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { formatHours, formatMinutes } from '@/lib/parsing/time';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import { computeSmartWindow, smartVisibleDays } from '@/lib/planner/grid';
import type { LeftOutCourse, Suggestion } from '@/lib/planner/suggest';
import type { LeftOutReason } from '@/lib/planner/suggestReasons';
import { toSnapshot } from '@/lib/planner/transaction';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { isScheduled, toPlacedSection } from './placedSection';
import { WeeklyGrid } from './WeeklyGrid';

/** The mini grid labels each block by its name and section; room and English stay out. */
const MINI_DISPLAY: DisplayOptions = {
  fitToContent: false,
  showRoom: false,
  showSection: true,
  showEnglishNames: false,
  showSubjectId: false,
};

const MINI_FONT_PX = 10;

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
  locked: readonly PlanEntry[];
  locale: Locale;
  t: Translate;
  onApply: () => void;
}

export function SuggestionCard({
  suggestion,
  index,
  locked,
  locale,
  t,
  onApply,
}: SuggestionCardProps) {
  const headingId = useId();
  const sections = useMemo(
    () => [
      ...locked.map((entry) =>
        toPlacedSection(entry.snapshot, entry.verifyStatus),
      ),
      ...suggestion.choices.flatMap((choice) =>
        choice.group.map((member) =>
          toPlacedSection(toSnapshot(choice.course, member)),
        ),
      ),
    ],
    [locked, suggestion],
  );
  const frame = useMemo(() => {
    const meetings = sections.flatMap((section) => section.meetings);
    return {
      window: computeSmartWindow(meetings),
      days: smartVisibleDays(meetings),
    };
  }, [sections]);
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
    <li className="flex flex-col gap-3 rounded-kcp border border-border p-3">
      <div className="flex items-center gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          {fillTemplate(t('suggest.option'), { number: index + 1 })}
        </h3>
        <button
          type="button"
          aria-describedby={headingId}
          onClick={onApply}
          className={`ml-auto rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${FOCUS_OUTLINE}`}
        >
          {t('suggest.apply')}
        </button>
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {facts.map(([label, value]) => (
          <div key={label} className="flex gap-1">
            <dt className="text-ink-soft">{t(label)}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="kcp-scroll overflow-x-auto">
        <WeeklyGrid
          sections={sections.filter(isScheduled)}
          window={frame.window}
          days={frame.days}
          locale={locale}
          t={t}
          editable={false}
          display={MINI_DISPLAY}
          fontPx={MINI_FONT_PX}
        />
      </div>
      {suggestion.leftOut.length > 0 ? (
        <LeftOutList leftOut={suggestion.leftOut} locale={locale} t={t} />
      ) : null}
    </li>
  );
}
