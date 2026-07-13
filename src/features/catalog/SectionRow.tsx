// A single section row inside a course card. It shows the section code, a lecture
// or practice badge, each meeting's day, time, and room, the instructors, the
// seat status, and the section's state relative to the plan. A time conflicting
// section keeps its conflict badge and reason but stays actionable: its add button
// routes to the blocked feedback strip instead of being disabled, so a keyboard
// user gets the same reason and alternatives a drag would give. A duplicate reads
// dimmed with its reason. When handlers are supplied the row offers an add button
// for an addable or conflicting open section and a remove button for an added one.

import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  Copy,
  FlaskConical,
  Info,
  Plus,
} from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { RemoveButton } from './RemoveButton';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import type { Term } from '@/lib/routing/academicTerms';
import { formatMinutes } from '@/lib/parsing/time';
import type { SeatStatus } from '@/lib/catalog/seatStatus';
import type { SectionRelation } from '@/lib/planner/sectionState';
import type { ConflictDetail } from '@/lib/planner/placement';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { Pill } from '@/components/Pill';
import { SeatPill } from './SeatPill';
import { meetingLabel } from './meetingFormat';

function StateBadge({
  relation,
  t,
}: {
  relation: SectionRelation;
  t: Translate;
}) {
  switch (relation.kind) {
    case 'added':
      return (
        <Pill tone="success" icon={<Check size={12} aria-hidden />}>
          {t('section.badge.added')}
        </Pill>
      );
    case 'conflicting':
      return (
        <Pill tone="danger" icon={<AlertTriangle size={12} aria-hidden />}>
          {t('section.badge.conflict')}
        </Pill>
      );
    case 'duplicate':
      return (
        <Pill tone="warn" icon={<Copy size={12} aria-hidden />}>
          {t('section.badge.duplicate')}
        </Pill>
      );
    case 'different_term':
      return (
        <Pill tone="neutral" icon={<CalendarClock size={12} aria-hidden />}>
          {t('section.badge.differentTerm')}
        </Pill>
      );
    case 'addable':
      return null;
  }
}

function termLabel(term: Term): string {
  return `${term.semester}/${term.year}`;
}

function conflictReason(conflicts: ConflictDetail[], t: Translate): string {
  const timeConflict = conflicts.find((conflict) => conflict.kind === 'time');
  if (timeConflict === undefined) {
    return t('section.badge.conflict');
  }
  const day = t(dayLabelKey(timeConflict.day));
  const time = `${formatMinutes(timeConflict.startMin)}-${formatMinutes(timeConflict.endMin)}`;
  return `${t('section.reason.conflictWith')} ${timeConflict.blocking.subjectId} ${t('section.code')} ${timeConflict.blocking.section} ${day} ${time}`;
}

interface SectionRowProps {
  course: Course;
  section: Section;
  relation: SectionRelation;
  seat: SeatStatus;
  locale: Locale;
  t: Translate;
  onAdd?: ((course: Course, section: Section) => void) | undefined;
  onRemove?: ((teachTableId: string) => void) | undefined;
  onSwitchTerm?: ((term: Term) => void) | undefined;
  /** Reference only: no action buttons, no state badge, no reason lines. Used by the
   * collapsed added course card when its sections are revealed. */
  readOnly?: boolean;
}

export function SectionRow({
  course,
  section,
  relation,
  seat,
  locale,
  t,
  onAdd,
  onRemove,
  onSwitchTerm,
  readOnly = false,
}: SectionRowProps) {
  const kind = section.kind;
  const teachers = locale === 'th' ? section.teachersTh : section.teachersEn;
  const dimmed =
    relation.kind === 'duplicate' || relation.kind === 'different_term';
  // The add affordance is a full height rail on the trailing edge rather than a
  // button in the wrapping controls strip, so it stays inside the row bounds. A
  // section that cannot be added shows the rail disabled with the reason in the row
  // body rather than omitting it, keeping the trailing edge consistent.
  const rail = readOnly
    ? 'none'
    : railKind(relation, seat, onAdd !== undefined);
  const addLabel = `${t('action.add')} ${section.subjectId} ${t('section.code')} ${section.section}`;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-kcp border border-border text-xs ${
        dimmed ? 'opacity-70' : ''
      }`}
    >
      <div className="@container min-w-0 flex-1 p-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-ink">
            {t('section.code')} {section.section}
          </span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Pill
              tone="neutral"
              icon={
                kind === 'practice' ? (
                  <FlaskConical size={12} aria-hidden />
                ) : (
                  <BookOpen size={12} aria-hidden />
                )
              }
            >
              {kind === 'practice'
                ? t('section.practice')
                : t('section.lecture')}
            </Pill>
            <SeatPill status={seat} t={t} />
            {readOnly ? null : <StateBadge relation={relation} t={t} />}
            {!readOnly &&
            relation.kind === 'added' &&
            onRemove !== undefined ? (
              <RemoveButton
                label={t('action.remove')}
                onRemove={() => {
                  onRemove(section.teachTableId);
                }}
              />
            ) : null}
            {!readOnly &&
            relation.kind === 'different_term' &&
            onSwitchTerm !== undefined ? (
              <button
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  onSwitchTerm(relation.browsedTerm);
                }}
                className="rounded-kcp border border-primary px-2 py-0.5 font-medium text-primary-strong outline-none hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {t('term.switch')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-0.5 text-ink-soft">
          {section.meetings.map((meeting) => (
            <span
              key={`${String(meeting.day)}-${String(meeting.startMin)}-${String(meeting.endMin)}`}
            >
              {meetingLabel(meeting, t)}
              {meeting.building !== '' || meeting.room !== ''
                ? ` ${meeting.building} ${meeting.room}`.trimEnd()
                : ''}
            </span>
          ))}
        </div>

        {teachers.length > 0 || section.remark !== '' ? (
          <div className="mt-1 flex items-center gap-1 text-ink-soft">
            {teachers.length > 0 ? (
              <Tooltip label={teachers.join(', ')}>
                {(triggerProps, ref) => (
                  <p
                    ref={ref}
                    {...triggerProps}
                    className="min-w-0 flex-1 truncate"
                  >
                    {teachers.join(', ')}
                  </p>
                )}
              </Tooltip>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {!readOnly && section.remark !== '' ? (
              <button
                type="button"
                aria-expanded={showDetails}
                aria-label={t('section.moreInfo')}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  setShowDetails((value) => !value);
                }}
                className={`shrink-0 rounded-kcp p-0.5 hover:text-ink ${FOCUS_RING}`}
              >
                <Info size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        {!readOnly && showDetails && section.remark !== '' ? (
          <p className="mt-1 text-ink-soft">{section.remark}</p>
        ) : null}

        {!readOnly && relation.kind === 'conflicting' ? (
          <p className="mt-1 text-danger">
            {conflictReason(relation.conflicts, t)}
          </p>
        ) : null}
        {!readOnly && relation.kind === 'duplicate' ? (
          <p className="mt-1 text-warn">{t('section.reason.duplicate')}</p>
        ) : null}
        {!readOnly && relation.kind === 'different_term' ? (
          <p className="mt-1 text-ink-soft">
            {t('term.planIs')} {termLabel(relation.planTerm)}.{' '}
            {t('term.sectionIs')} {termLabel(relation.browsedTerm)}
          </p>
        ) : null}
      </div>
      {rail === 'add' && onAdd !== undefined ? (
        <AddRail
          label={addLabel}
          onAdd={() => {
            onAdd(course, section);
          }}
        />
      ) : rail === 'disabled' ? (
        <DisabledRail label={addLabel} />
      ) : null}
    </div>
  );
}

type RailKind = 'add' | 'disabled' | 'none';

/**
 * The trailing rail state for a section. A read only row has no rail. A row that is
 * added or a duplicate subject has none either, since neither can be added. A full,
 * closed, or different term section shows a disabled rail with the reason in the row
 * body. Otherwise an addable or a conflicting open section shows the add rail; a
 * conflicting add routes to the blocked feedback like the drag does.
 */
function railKind(
  relation: SectionRelation,
  seat: SeatStatus,
  hasAdd: boolean,
): RailKind {
  if (relation.kind === 'added' || relation.kind === 'duplicate') {
    return 'none';
  }
  if (seat.kind === 'full' || seat.kind === 'closed') {
    return 'disabled';
  }
  if (relation.kind === 'different_term') {
    return 'disabled';
  }
  // relation.kind is now addable or conflicting, both addable while the seat is open;
  // a conflicting add routes to the blocked feedback like a drag does.
  return hasAdd ? 'add' : 'none';
}

// The add rail is a quiet affordance, not the primary path: drag is primary, add is
// secondary. It rests as a soft tinted column with the accent icon and fills to solid
// only on hover and focus. Its own bordered column (w-8, shrink-0, border-l) means it
// never overlaps the row body, which stays min-w-0 and clips rather than spilling into
// the rail at any card width. The accent icon on the soft surface and white on the
// solid hover fill both clear the AA text bar (token-contrast.test.ts).
function AddRail({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <Tooltip label={label}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-label={label}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={onAdd}
          className={`flex w-8 shrink-0 items-center justify-center border-l border-border bg-primary-soft text-primary-strong hover:bg-primary-strong hover:text-white focus-visible:bg-primary-strong focus-visible:text-white ${FOCUS_OUTLINE}`}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </Tooltip>
  );
}

function DisabledRail({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-label={label}
      className="flex w-8 shrink-0 items-center justify-center border-l border-border bg-surface-alt text-ink-soft"
    >
      <Plus size={16} aria-hidden className="opacity-40" />
    </button>
  );
}
