// Format a meeting for the catalog rows: the Thai day abbreviation from the
// dictionary plus the start and end times. The day key map is the one place the
// numeric DayOfWeek is turned into a translation key.

import { formatMinutes } from '@/lib/parsing/time';
import type { DayOfWeek, Meeting } from '@/lib/domain/types';
import type { Translate, TranslationKey } from '@/lib/i18n/t';

const DAY_KEYS: Record<DayOfWeek, TranslationKey> = {
  0: 'day.0',
  1: 'day.1',
  2: 'day.2',
  3: 'day.3',
  4: 'day.4',
  5: 'day.5',
  6: 'day.6',
};

export function dayLabelKey(day: DayOfWeek): TranslationKey {
  return DAY_KEYS[day];
}

export function meetingLabel(meeting: Meeting, t: Translate): string {
  return `${t(dayLabelKey(meeting.day))} ${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
}
