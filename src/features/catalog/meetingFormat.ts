// Format a meeting for the catalog rows: the day abbreviation from the dictionary
// plus the start and end times. The day key mapping is shared from lib/i18n so the
// numeric DayOfWeek is turned into a translation key in one place.

import { formatMinutes } from '@/lib/parsing/time';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import type { Meeting } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';

export function meetingLabel(meeting: Meeting, t: Translate): string {
  return `${t(dayLabelKey(meeting.day))} ${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
}
