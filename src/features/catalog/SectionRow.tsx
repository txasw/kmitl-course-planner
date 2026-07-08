// A single section row inside a course card. It shows the section code, a lecture
// or practice badge, each meeting's day, time, and room, the instructors, the
// seat status, and the section's state relative to the plan. Conflicting and
// duplicate sections read dimmed with a stated reason. Add and remove actions and
// dragging arrive in the planner phase; this row is presentational.

import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import { formatMinutes } from '@/lib/parsing/time';
import type { SeatStatus } from '@/lib/catalog/seatStatus';
import type { SectionRelation } from '@/lib/planner/sectionState';
import type { ConflictDetail } from '@/lib/planner/placement';
import { Pill } from './Pill';
import { SeatPill } from './SeatPill';
import { dayLabelKey, meetingLabel } from './meetingFormat';

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
    case 'addable':
      return null;
  }
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
}

export function SectionRow({
  section,
  relation,
  seat,
  locale,
  t,
}: SectionRowProps) {
  const kind = section.meetings[0]?.kind ?? 'lecture';
  const teachers = locale === 'th' ? section.teachersTh : section.teachersEn;
  const dimmed =
    relation.kind === 'conflicting' || relation.kind === 'duplicate';

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
          <StateBadge relation={relation} t={t} />
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

      {teachers.length > 0 ? (
        <p className="mt-1 text-ink-soft">{teachers.join(', ')}</p>
      ) : null}

      {relation.kind === 'conflicting' ? (
        <p className="mt-1 text-danger">
          {conflictReason(relation.conflicts, t)}
        </p>
      ) : null}
      {relation.kind === 'duplicate' ? (
        <p className="mt-1 text-warn">{t('section.reason.duplicate')}</p>
      ) : null}
    </div>
  );
}
