// A single section row inside a course card. It shows the section code, a lecture
// or practice badge, each meeting's day, time, and room, the instructors, the
// seat status, and the section's state relative to the plan. A time conflicting
// section keeps its conflict badge and reason but stays actionable: its add button
// routes to the blocked feedback strip instead of being disabled, so a keyboard
// user gets the same reason and alternatives a drag would give. A duplicate reads
// dimmed with its reason. When handlers are supplied the row offers an add button
// for an addable or conflicting open section and a remove button for an added one.

import { useState } from 'react';
import { Info } from 'lucide-react';
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
import { FOCUS_RING } from '@/lib/ui/focus';
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
      return <Pill tone="success">{t('section.badge.added')}</Pill>;
    case 'conflicting':
      return <Pill tone="danger">{t('section.badge.conflict')}</Pill>;
    case 'duplicate':
      return <Pill tone="warn">{t('section.badge.duplicate')}</Pill>;
    case 'different_term':
      return <Pill tone="neutral">{t('section.badge.differentTerm')}</Pill>;
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
  const addable =
    (relation.kind === 'addable' || relation.kind === 'conflicting') &&
    seat.kind === 'open';
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={`rounded-kcp border border-border p-2 text-xs ${
        dimmed ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink">
          {t('section.code')} {section.section}
        </span>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Pill tone="neutral">
            {kind === 'practice' ? t('section.practice') : t('section.lecture')}
          </Pill>
          <SeatPill status={seat} t={t} />
          {readOnly ? null : <StateBadge relation={relation} t={t} />}
          {!readOnly && addable && onAdd !== undefined ? (
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                onAdd(course, section);
              }}
              className="rounded-kcp bg-primary-strong px-2 py-0.5 font-medium text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('action.add')}
            </button>
          ) : null}
          {!readOnly && relation.kind === 'added' && onRemove !== undefined ? (
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
  );
}
