// Format a meeting for the catalog rows and the section detail list: the day name from
// the dictionary plus the start and end times, and the place it is held. The day key
// mapping is shared from lib/i18n so the numeric DayOfWeek is turned into a translation
// key in one place.

import { formatMinutes } from '@/lib/parsing/time';
import { dayFullLabelKey, dayLabelKey } from '@/lib/i18n/dayLabel';
import type { Meeting } from '@/lib/domain/types';
import type { Translate } from '@/lib/i18n/t';

function meetingTime(meeting: Meeting): string {
  return `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
}

/** The short day abbreviation and the times, for dense catalog rows. */
export function meetingLabel(meeting: Meeting, t: Translate): string {
  return `${t(dayLabelKey(meeting.day))} ${meetingTime(meeting)}`;
}

/** The full day name and the times, for detail surfaces where the long form fits. */
export function meetingFullLabel(meeting: Meeting, t: Translate): string {
  return `${t(dayFullLabelKey(meeting.day))} ${meetingTime(meeting)}`;
}

/** The building then the room, or an empty string for a meeting with neither, such as
 * an online class. */
export function meetingPlace(meeting: Meeting): string {
  return [meeting.building, meeting.room]
    .filter((part) => part !== '')
    .join(' ');
}
