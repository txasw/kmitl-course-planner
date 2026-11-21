// The facts of the plan status row, apart from the row layout so StatsBar reads as the
// arrangement of the two tiers (ADR-0049 amendment of 2026-11-21): the credit total with its
// load note, the subject count, the unscheduled count, the clash state, and the free days.

import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarOff,
  Info,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { CREDIT_UNIT, SUBJECT_UNIT, unitWord } from '@/lib/i18n/counts';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import { fillTemplate } from '@/lib/i18n/template';
import type { DayOfWeek } from '@/lib/parsing/days';
import { creditLoad, type CreditLoad } from '@/lib/planner/credits';
import { computeFreePeriods } from '@/lib/planner/freePeriods';
import type { Semester } from '@/lib/routing/academicTerms';
import { FOCUS_RING } from '@/lib/ui/focus';
import { SMALL_ICON } from '@/lib/ui/icon';
import { TARGET_SIZE } from '@/lib/ui/target';
import { StatusReveal } from './StatusReveal';
import { planTotals } from './planTotals';
import type { PlacedSection } from './placedSection';

const NUMBER_TYPE = 'text-base font-semibold tabular-nums';
const NUMBER = `${NUMBER_TYPE} text-ink`;
export const FACT = 'inline-flex items-center gap-1';

export interface PlanFacts {
  totals: ReturnType<typeof planTotals>;
  load: CreditLoad;
  freeDays: readonly DayOfWeek[];
}

export function planFacts(
  sections: PlacedSection[],
  semester: Semester | null,
): PlanFacts {
  const totals = planTotals(sections);
  const load: CreditLoad =
    semester === null
      ? { kind: 'within' }
      : creditLoad(totals.credits, semester, sections.length);
  const { freeDays } = computeFreePeriods(
    sections.flatMap((section) => section.meetings),
  );
  return { totals, load, freeDays };
}

interface CreditsFactProps {
  facts: PlanFacts;
  /** Fold an outside load note into the fact, as a warn button that reveals it. */
  compact: boolean;
  t: Translate;
}

/** The credit total, the lead number of the row. In warn ink when the total leaves the usual
 * load; on a phone the note folds into the fact behind a warn glyph a tap reveals. */
export function CreditsFact({ facts, compact, t }: CreditsFactProps) {
  const { totals, load } = facts;
  const unit = unitWord(t, totals.credits, CREDIT_UNIT);
  const content = (
    <>
      <BookOpen {...SMALL_ICON} />
      <span>
        <span
          className={`${NUMBER_TYPE} ${load.kind === 'within' ? 'text-ink' : 'text-warn'}`}
        >
          {totals.credits}
        </span>{' '}
        {unit}
      </span>
    </>
  );
  if (!compact || load.kind === 'within') {
    return <span className={FACT}>{content}</span>;
  }
  const note = creditLoadText(load, t);
  return (
    <span data-credit-load={load.kind} className="-ml-1 inline-flex">
      <StatusReveal
        label={fillTemplate(t('stats.creditsWithNote'), {
          count: totals.credits,
          unit,
          note,
        })}
        detail={<p className="text-warn">{note}</p>}
        toneClass="text-warn"
      >
        {content}
        <AlertCircle {...SMALL_ICON} />
      </StatusReveal>
    </span>
  );
}

interface CountProps {
  count: number;
  t: Translate;
}

export function SubjectsFact({ count, t }: CountProps) {
  return (
    <span className={FACT}>
      <Layers {...SMALL_ICON} />
      <span>
        <span className={NUMBER}>{count}</span>{' '}
        {unitWord(t, count, SUBJECT_UNIT)}
      </span>
    </span>
  );
}

/** The count of sections with no meeting as its glyph and number, its words read by
 * assistive technology and by a mouse; the labelled shelf under the timetable lists them. */
export function UnscheduledCount({ count, t }: CountProps) {
  const words = `${String(count)} ${t('footer.unscheduled')}`;
  return (
    <span className={FACT} title={words}>
      <CalendarOff {...SMALL_ICON} />
      <span aria-hidden className={NUMBER}>
        {count}
      </span>
      <span className="sr-only">{words}</span>
    </span>
  );
}

interface ClashStateProps {
  conflictCount: number;
  onShowConflict: () => void;
  compact: boolean;
  t: Translate;
}

/** The clash state: a danger button to the first clash, or a quiet shield when none. */
export function ClashState({
  conflictCount,
  onShowConflict,
  compact,
  t,
}: ClashStateProps) {
  if (conflictCount > 0) {
    return (
      <button
        type="button"
        onClick={onShowConflict}
        className={`inline-flex shrink-0 items-center gap-1 rounded-kcp border border-danger bg-surface px-2 py-1 text-danger hover:bg-danger-soft ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        <AlertTriangle {...SMALL_ICON} />
        {fillTemplate(t('stats.conflicts'), { count: conflictCount })}
      </button>
    );
  }
  return (
    <span className={FACT} data-no-conflicts>
      <ShieldCheck {...SMALL_ICON} className="text-success" />
      {compact ? (
        <>
          <span aria-hidden>{t('stats.noConflictsShort')}</span>
          <span className="sr-only">{t('stats.noConflicts')}</span>
        </>
      ) : (
        <span>{t('stats.noConflicts')}</span>
      )}
    </span>
  );
}

interface FreeDaysProps {
  days: readonly DayOfWeek[];
  t: Translate;
}

/** The free weekdays as short labels on screen and as full names to assistive
 * technology, which would otherwise spell out a single character. */
export function FreeDays({ days, t }: FreeDaysProps) {
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

/** The note that the total sits outside the usual load. It never claims the plan is invalid,
 * since final year students and approved loads may leave the range. */
function creditLoadText(
  load: Exclude<CreditLoad, { kind: 'within' }>,
  t: Translate,
): string {
  return load.kind === 'below'
    ? fillTemplate(t('stats.creditsBelow'), { min: load.min })
    : fillTemplate(t('stats.creditsAbove'), { max: load.max });
}

/** The note in words beside the total, a neutral warn line rather than a control. */
export function CreditLoadNote({ load, t }: CreditLoadNoteProps) {
  return (
    <span className="inline-flex items-center gap-1 text-warn">
      <Info {...SMALL_ICON} />
      {creditLoadText(load, t)}
    </span>
  );
}
