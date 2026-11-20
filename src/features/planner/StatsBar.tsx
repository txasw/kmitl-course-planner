// The edit mode plan status row, pinned to the foot of the plan region under every plan view
// and at every tier, so the thumb reaches it on a phone. Its facts lead with icons: the credits
// as the lead number, in warn ink with a short note when the total leaves the usual load of the
// plan's semester (advisory only, nothing is blocked), the distinct subject count, whether any
// section pair clashes, the count of sections with no meeting when the plan holds any, and the
// verification status the panel slots in. From 640 px up the row also states the scheduled
// load per day and the weekdays with no class; on a phone the day chips above the timetable
// already mark the class days and the summary view carries the load, so the row stays slim.
// The suggest action the panel slots in sits at the end of the row, outside the wrapping facts,
// so it keeps its place at the right edge (ADR-0049 amendment).
// A clash is the one item the student acts on, so it is a danger button that points at the
// first clashing section on the timetable; with none the row says so quietly with a shield
// check, as an icon alone on a phone with the words kept for assistive technology. The shield
// keeps that glyph apart from the plain check of a verified plan beside it.
// The poster states the same totals in its own footer line, without the clash control and
// without the free days, which describe the student's week rather than the timetable
// being shared.

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Info,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import { fillTemplate } from '@/lib/i18n/template';
import type { DayOfWeek } from '@/lib/parsing/days';
import { creditLoad, type CreditLoad } from '@/lib/planner/credits';
import { computeFreePeriods } from '@/lib/planner/freePeriods';
import type { Semester } from '@/lib/routing/academicTerms';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { DayLoads } from './DayLoads';
import { planTotals } from './planTotals';
import type { PlacedSection } from './placedSection';

interface StatsBarProps {
  sections: PlacedSection[];
  /** The active plan's semester, which sets the usual credit load; null when no plan is open. */
  semester: Semester | null;
  /** Distinct section pairs that clash on time or on an exam window. */
  conflictCount: number;
  /** Bring the first clashing section into view and focus it. */
  onShowConflict: () => void;
  /** The verification status, pushed to the end of the facts. */
  status?: ReactNode;
  /** The action at the end of the row, outside the wrapping facts. */
  action?: ReactNode;
  /** Whether the row sits on a phone, which keeps it to the slim facts. */
  compact?: boolean;
  locale: Locale;
  t: Translate;
}

const NUMBER_TYPE = 'text-base font-semibold tabular-nums';
const NUMBER = `${NUMBER_TYPE} text-ink`;
const FACT = 'inline-flex items-center gap-1';
const ICON = { size: 14, strokeWidth: 2, 'aria-hidden': true } as const;

export function StatsBar({
  sections,
  semester,
  conflictCount,
  onShowConflict,
  status,
  action,
  compact = false,
  locale,
  t,
}: StatsBarProps) {
  return (
    <div
      role="group"
      aria-label={t('stats.region')}
      className="flex shrink-0 items-center gap-2 border-t border-border pt-2 text-xs text-ink-soft"
    >
      {sections.length > 0 ? (
        <PlanFacts
          sections={sections}
          semester={semester}
          conflictCount={conflictCount}
          onShowConflict={onShowConflict}
          status={status}
          compact={compact}
          locale={locale}
          t={t}
        />
      ) : null}
      {action === undefined ? null : <div className="ml-auto">{action}</div>}
    </div>
  );
}

type PlanFactsProps = Omit<StatsBarProps, 'action' | 'compact'> & {
  compact: boolean;
};

/** The wrapping facts of the row, which take the room the action leaves. */
function PlanFacts({
  sections,
  semester,
  conflictCount,
  onShowConflict,
  status,
  compact,
  locale,
  t,
}: PlanFactsProps) {
  const totals = planTotals(sections);
  const load: CreditLoad =
    semester === null
      ? { kind: 'within' }
      : creditLoad(totals.credits, semester, sections.length);
  const { freeDays } = computeFreePeriods(
    sections.flatMap((section) => section.meetings),
  );

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
      <span className={FACT}>
        <BookOpen {...ICON} />
        <span>
          <span
            className={`${NUMBER_TYPE} ${load.kind === 'within' ? 'text-ink' : 'text-warn'}`}
          >
            {totals.credits}
          </span>{' '}
          {t('footer.credits')}
        </span>
      </span>
      {load.kind === 'within' ? null : <CreditLoadNote load={load} t={t} />}
      <span className={FACT}>
        <Layers {...ICON} />
        <span>
          <span className={NUMBER}>{totals.subjects}</span>{' '}
          {t('footer.subjects')}
        </span>
      </span>
      {conflictCount > 0 ? (
        <button
          type="button"
          onClick={onShowConflict}
          className={`inline-flex items-center gap-1 rounded-kcp border border-danger bg-surface px-2 py-1 text-danger hover:bg-danger-soft ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          <AlertTriangle {...ICON} />
          {fillTemplate(t('stats.conflicts'), { count: conflictCount })}
        </button>
      ) : (
        <span
          className={FACT}
          data-no-conflicts
          title={compact ? t('stats.noConflicts') : undefined}
        >
          <ShieldCheck {...ICON} className="text-success" />
          <span className={compact ? 'sr-only' : undefined}>
            {t('stats.noConflicts')}
          </span>
        </span>
      )}
      {compact ? null : <DayLoads load={totals.load} locale={locale} t={t} />}
      {totals.unscheduled > 0 ? (
        <span>
          {totals.unscheduled} {t('footer.unscheduled')}
        </span>
      ) : null}
      {!compact && freeDays.length > 0 ? (
        <FreeDays days={freeDays} t={t} />
      ) : null}
      {status === undefined ? null : <span className="ml-auto">{status}</span>}
    </div>
  );
}

interface FreeDaysProps {
  days: readonly DayOfWeek[];
  t: Translate;
}

/** The free weekdays as short labels on screen and as full names to assistive
 * technology, which would otherwise spell out a single character. */
function FreeDays({ days, t }: FreeDaysProps) {
  const list = (key: (day: DayOfWeek) => TranslationKey) =>
    fillTemplate(t('stats.freeDays'), {
      days: days.map((day) => t(key(day))).join(' '),
    });
  return (
    <span>
      <span aria-hidden>{list(dayLabelKey)}</span>
      <span className="sr-only">{list(dayFullLabelKey)}</span>
    </span>
  );
}

interface CreditLoadNoteProps {
  load: Exclude<CreditLoad, { kind: 'within' }>;
  t: Translate;
}

/** A neutral note that the total sits outside the usual load. It never claims the plan is
 * invalid, since final year students and approved loads may leave the range. */
function CreditLoadNote({ load, t }: CreditLoadNoteProps) {
  const text =
    load.kind === 'below'
      ? fillTemplate(t('stats.creditsBelow'), { min: load.min })
      : fillTemplate(t('stats.creditsAbove'), { max: load.max });
  return (
    <span className="inline-flex items-center gap-1 text-warn">
      <Info size={14} strokeWidth={2} aria-hidden />
      {text}
    </span>
  );
}
