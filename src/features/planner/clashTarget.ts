// The clash the stats bar conflict action points at. Of the sections in a time or exam
// conflict, it is the one whose earliest meeting comes first in the week, Sunday first like
// the grid rows, or when none of them meets, the first listed unscheduled one, as the shelf
// lists them. It reads the placed sections rather than the DOM, because the day view
// renders one day at a time and the clash may sit on another, so it also names the day
// that view must show before the block can take focus.

import type { DayOfWeek } from '@/lib/parsing/days';
import { meetingOrder } from './blockFocus';
import type { PlacedSection } from './placedSection';

export interface ClashTarget {
  teachTableId: string;
  /** The day of the section's earliest meeting, or null for a section with no meeting. */
  day: DayOfWeek | null;
}

export function firstClash(
  sections: readonly PlacedSection[],
  clashing: ReadonlySet<string>,
): ClashTarget | null {
  let earliest: { target: ClashTarget; order: number } | null = null;
  let unscheduled: ClashTarget | null = null;
  for (const section of sections) {
    if (!clashing.has(section.teachTableId)) {
      continue;
    }
    if (section.meetings.length === 0) {
      unscheduled ??= { teachTableId: section.teachTableId, day: null };
      continue;
    }
    for (const meeting of section.meetings) {
      const order = meetingOrder(meeting);
      if (earliest === null || order < earliest.order) {
        earliest = {
          target: { teachTableId: section.teachTableId, day: meeting.day },
          order,
        };
      }
    }
  }
  return earliest?.target ?? unscheduled;
}
