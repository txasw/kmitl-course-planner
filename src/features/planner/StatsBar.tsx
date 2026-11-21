// The edit mode plan status row, pinned to the foot of the plan region under every plan view
// and at every tier, so the thumb reaches it on a phone. Its facts lead with icons: the credits
// as the lead number, in warn ink with a short note when the total leaves the usual load of the
// plan's semester (advisory only, nothing is blocked), the distinct subject count, whether any
// section pair clashes, the count of sections with no meeting when the plan holds any, and the
// verification status the panel slots in. From 640 px up the row also states the scheduled
// load per day and the weekdays with no class, and the facts wrap beside the suggest action the
// panel slots in at the end of the row, outside the wrapping facts, so it keeps its place at the
// right edge (ADR-0049 amendment).
// On a phone the row keeps to two lines, so the timetable keeps its height (ADR-0049 amendment
// of 2026-11-21): the first line holds the plan facts as glyphs and numbers, the second the
// checks, the clash state and the verification glyph, with the suggest action at its end. The
// day chips above the timetable already mark the class days and the summary view carries the
// load, so neither repeats here. A fact that needs a sentence folds into its glyph and keeps its
// words one tap away: the credit load note turns the credit fact into a warn button that reveals
// the note, the verification status is its tone glyph, and the unscheduled count names itself to
// assistive technology and to a mouse.
// A clash is the one item the student acts on, so it is a danger button that points at the
// first clashing section on the timetable; with none the row says so quietly with a shield
// check and its words. On a phone the words shorten to ไม่ชน (No clash) beside the shield, so
// a touch user, who never sees a hover tooltip, reads the meaning, while assistive technology
// keeps the full words. The shield keeps that glyph apart from the plain check of a verified
// plan beside it.
// The poster states the same totals in its own footer line, without the clash control and
// without the free days, which describe the student's week rather than the timetable
// being shared.

import type { ReactNode } from 'react';
import { CalendarOff } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Semester } from '@/lib/routing/academicTerms';
import { SMALL_ICON } from '@/lib/ui/icon';
import { DayLoads } from './DayLoads';
import type { PlacedSection } from './placedSection';
import {
  ClashState,
  CreditLoadNote,
  CreditsFact,
  FACT,
  FreeDays,
  SubjectsFact,
  UnscheduledCount,
  planFacts,
} from './StatusFacts';

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
  const facts = sections.length > 0 ? planFacts(sections, semester) : null;
  const actionSlot =
    action === undefined ? null : <div className="ml-auto">{action}</div>;
  const clash = (
    <ClashState
      conflictCount={conflictCount}
      onShowConflict={onShowConflict}
      compact={compact}
      t={t}
    />
  );

  if (compact) {
    return (
      <div
        role="group"
        aria-label={t('stats.region')}
        data-status-row="compact"
        className="flex shrink-0 flex-col gap-1 border-t border-border pt-1.5 text-xs text-ink-soft"
      >
        {facts === null ? null : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CreditsFact facts={facts} compact t={t} />
            <SubjectsFact count={facts.totals.subjects} t={t} />
            {facts.totals.unscheduled > 0 ? (
              <UnscheduledCount count={facts.totals.unscheduled} t={t} />
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {facts === null ? null : (
            <>
              {clash}
              {status}
            </>
          )}
          {actionSlot}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('stats.region')}
      className="flex shrink-0 items-center gap-2 border-t border-border pt-2 text-xs text-ink-soft"
    >
      {facts === null ? null : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          <CreditsFact facts={facts} compact={false} t={t} />
          {facts.load.kind === 'within' ? null : (
            <CreditLoadNote load={facts.load} t={t} />
          )}
          <SubjectsFact count={facts.totals.subjects} t={t} />
          {clash}
          <DayLoads load={facts.totals.load} locale={locale} t={t} />
          {facts.totals.unscheduled > 0 ? (
            <span className={FACT}>
              <CalendarOff {...SMALL_ICON} />
              <span>
                {facts.totals.unscheduled} {t('footer.unscheduled')}
              </span>
            </span>
          ) : null}
          {facts.freeDays.length > 0 ? (
            <FreeDays days={facts.freeDays} t={t} />
          ) : null}
          {status === undefined ? null : (
            <span className="ml-auto">{status}</span>
          )}
        </div>
      )}
      {actionSlot}
    </div>
  );
}
