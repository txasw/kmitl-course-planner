// Turn a reconcile entry diff, or an update review item, into old versus new rows for
// the updates dialog and the block popover. Each changed field becomes one row with a
// label and its before and after values, formatted for reading rather than as raw data,
// with exam dates in the Buddhist year through the shared exam formatter.

import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import type { Meeting, Seats } from '@/lib/domain/types';
import type { SectionSnapshot } from '@/lib/domain/plan';
import type { ChangeKind } from '@/lib/planner/revalidateDiff';
import type { EntryDiff } from '@/lib/planner/reconcile';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { examWindowTexts } from './examText';

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

function examText(snapshot: SectionSnapshot, t: Translate): string {
  const windows = examWindowTexts(snapshot.exam, t);
  if (windows.length === 0) {
    return t('exam.selfArranged');
  }
  return windows
    .map((window) => `${t(`exam.${window.kind}`)} ${window.text}`)
    .join(', ');
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
      return examText(snapshot, t);
  }
}

/** The old versus new rows for the listed changes between two versions of a section,
 * a reconcile diff or an update review item; empty for an unchanged entry or one no
 * longer listed. */
export function describeEntryDiff(
  diff: Pick<EntryDiff, 'changes' | 'before' | 'after'>,
  locale: Locale,
  t: Translate,
): DiffRow[] {
  const { after } = diff;
  if (after === null) {
    return [];
  }
  return diff.changes.map((change) => ({
    label: t(CHANGE_LABEL[change]),
    old: fieldValue(change, diff.before, locale, t),
    next: fieldValue(change, after, locale, t),
  }));
}
