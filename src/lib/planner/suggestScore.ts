// Score a candidate timetable for the plan suggestion search. A preference is a
// penalty where lower is better, so the search can rank any two timetables that
// tie on the objective. Every measure reads only the meetings, so a locked entry
// and a chosen section count the same way.
//
// Morning penalises the minutes of class after noon and afternoon the minutes
// before it. Fewer days counts the distinct days with a class. Compact counts the
// idle minutes between classes on the same day. Balanced weighs each class day as
// an hour of idle time, so it prefers a short week without packing a day full of
// gaps. The search prunes with penaltyLowerBound, which must never exceed the
// penalty of any timetable that adds meetings to the given ones.

import type { DayOfWeek, Meeting } from '../domain/types';

/** The preferences in the order the suggestion dialog offers them. */
export const SUGGEST_PREFERENCES = [
  'balanced',
  'morning',
  'afternoon',
  'fewerDays',
  'compact',
] as const;

export type SuggestPreference = (typeof SUGGEST_PREFERENCES)[number];

/** Noon as minutes since midnight, the boundary between morning and afternoon. */
export const NOON_MIN = 12 * 60;

/** The idle minutes one extra class day weighs in the balanced preference. */
export const BALANCED_DAY_WEIGHT = 60;

export interface TimetableStats {
  /** Distinct days with at least one meeting. */
  days: number;
  /** The earliest start of any meeting, or null with no meeting. */
  earliestStartMin: number | null;
  /** The latest end of any meeting, or null with no meeting. */
  latestEndMin: number | null;
  /** Minutes between classes on the same day, summed over the week. */
  idleMinutes: number;
}

function meetingsByDay(
  meetings: readonly Meeting[],
): Map<DayOfWeek, Meeting[]> {
  const byDay = new Map<DayOfWeek, Meeting[]>();
  for (const meeting of meetings) {
    const list = byDay.get(meeting.day);
    if (list === undefined) {
      byDay.set(meeting.day, [meeting]);
    } else {
      list.push(meeting);
    }
  }
  return byDay;
}

/** Gaps between the merged class intervals of one day. Overlapping or touching
 * meetings merge first, so an overlap never reads as negative idle time. */
function dayIdleMinutes(meetings: Meeting[]): number {
  const sorted = [...meetings].sort((a, b) => a.startMin - b.startMin);
  let idle = 0;
  let coveredUntil: number | null = null;
  for (const meeting of sorted) {
    if (coveredUntil !== null && meeting.startMin > coveredUntil) {
      idle += meeting.startMin - coveredUntil;
    }
    coveredUntil =
      coveredUntil === null
        ? meeting.endMin
        : Math.max(coveredUntil, meeting.endMin);
  }
  return idle;
}

function idleMinutes(byDay: Map<DayOfWeek, Meeting[]>): number {
  let idle = 0;
  for (const meetings of byDay.values()) {
    idle += dayIdleMinutes(meetings);
  }
  return idle;
}

/** The shape of a timetable: its days, its span, and its idle time. */
export function timetableStats(meetings: readonly Meeting[]): TimetableStats {
  const byDay = meetingsByDay(meetings);
  let earliestStartMin: number | null = null;
  let latestEndMin: number | null = null;
  for (const meeting of meetings) {
    earliestStartMin =
      earliestStartMin === null
        ? meeting.startMin
        : Math.min(earliestStartMin, meeting.startMin);
    latestEndMin =
      latestEndMin === null
        ? meeting.endMin
        : Math.max(latestEndMin, meeting.endMin);
  }
  return {
    days: byDay.size,
    earliestStartMin,
    latestEndMin,
    idleMinutes: idleMinutes(byDay),
  };
}

function minutesAfterNoon(meetings: readonly Meeting[]): number {
  let total = 0;
  for (const meeting of meetings) {
    total += Math.max(0, meeting.endMin - Math.max(meeting.startMin, NOON_MIN));
  }
  return total;
}

function minutesBeforeNoon(meetings: readonly Meeting[]): number {
  let total = 0;
  for (const meeting of meetings) {
    total += Math.max(0, Math.min(meeting.endMin, NOON_MIN) - meeting.startMin);
  }
  return total;
}

function distinctDays(meetings: readonly Meeting[]): number {
  return new Set(meetings.map((meeting) => meeting.day)).size;
}

/** The penalty a timetable carries under a preference; lower is better. */
export function preferencePenalty(
  meetings: readonly Meeting[],
  preference: SuggestPreference,
): number {
  switch (preference) {
    case 'morning':
      return minutesAfterNoon(meetings);
    case 'afternoon':
      return minutesBeforeNoon(meetings);
    case 'fewerDays':
      return distinctDays(meetings);
    case 'compact':
      return idleMinutes(meetingsByDay(meetings));
    case 'balanced': {
      const byDay = meetingsByDay(meetings);
      return byDay.size * BALANCED_DAY_WEIGHT + idleMinutes(byDay);
    }
  }
}

/**
 * The least penalty any timetable holding these meetings can reach. Class minutes and
 * class days only grow as meetings are added, so those parts are exact bounds. Idle
 * time can shrink when a later class fills a gap, so it contributes nothing.
 */
export function penaltyLowerBound(
  meetings: readonly Meeting[],
  preference: SuggestPreference,
): number {
  switch (preference) {
    case 'morning':
    case 'afternoon':
    case 'fewerDays':
      return preferencePenalty(meetings, preference);
    case 'compact':
      return 0;
    case 'balanced':
      return distinctDays(meetings) * BALANCED_DAY_WEIGHT;
  }
}
