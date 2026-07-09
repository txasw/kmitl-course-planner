// Turn a reconcile entry diff into old versus new rows for the detail sheet and the
// block popover. Each changed field becomes one row with a label and its before and
// after values, formatted for reading rather than as raw data.

import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import type { Meeting, Seats } from '@/lib/domain/types';
import type { SectionSnapshot } from '@/lib/domain/plan';
import type { ChangeKind, EntryDiff } from '@/lib/planner/revalidate';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';

export interface DiffRow {
  label: string;
  old: string;
  next: string;
}

function meetingsText(meetings: Meeting[], t: Translate): string {
  if (meetings.length === 0) {
    return t('footer.unscheduled');
  }
  return meetings
    .map(
      (meeting) =>
        `${t(dayLabelKey(meeting.day))} ${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`,
    )
    .join(', ');
}

function roomsText(meetings: Meeting[]): string {
  const rooms = meetings
    .map((meeting) => `${meeting.building} ${meeting.room}`.trim())
    .filter((room) => room !== '');
  return rooms.length === 0 ? '-' : rooms.join(', ');
}

function seatsText(seats: Seats, t: Translate): string {
  if (seats.enrolled === 'full') {
    return t('seat.full');
  }
  const limit = seats.limit === null ? '-' : String(seats.limit);
  return `${String(seats.enrolled)}/${limit}`;
}

const CHANGE_LABEL: Record<ChangeKind, TranslationKey> = {
  time_changed: 'diff.time',
  room_changed: 'diff.room',
  teacher_changed: 'diff.teacher',
  seats_changed: 'diff.seats',
  pair_changed: 'diff.pair',
  exam_changed: 'diff.exam',
};

function fieldValue(
  change: ChangeKind,
  snapshot: SectionSnapshot,
  locale: Locale,
  t: Translate,
): string {
  switch (change) {
    case 'time_changed':
      return meetingsText(snapshot.meetings, t);
    case 'room_changed':
      return roomsText(snapshot.meetings);
    case 'teacher_changed': {
      const teachers =
        locale === 'th' ? snapshot.teachersTh : snapshot.teachersEn;
      return teachers.length === 0 ? '-' : teachers.join(', ');
    }
    case 'seats_changed':
      return seatsText(snapshot.seats, t);
    case 'pair_changed':
      return snapshot.pairedSection ?? '-';
    case 'exam_changed':
      return snapshot.exam.final?.start ?? snapshot.exam.midterm?.start ?? '-';
  }
}

/** The old versus new rows for a changed entry; empty for an unchanged or missing one. */
export function describeEntryDiff(
  diff: EntryDiff,
  locale: Locale,
  t: Translate,
): DiffRow[] {
  if (diff.after === null) {
    return [];
  }
  const after = diff.after;
  return diff.changes.map((change) => ({
    label: t(CHANGE_LABEL[change]),
    old: fieldValue(change, diff.before, locale, t),
    next: fieldValue(change, after, locale, t),
  }));
}
