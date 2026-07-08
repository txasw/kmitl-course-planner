// The normalized domain entities the application renders from. These are the
// clean shapes produced by the normalization pipeline out of the raw API rows.
// They carry no API quirks: HTML is already parsed to text, times are minutes,
// days are 0 based, and the count union is reduced to a discriminated value.

import type { DayOfWeek } from '../parsing/days';

export type { DayOfWeek };

export type MeetingKind = 'lecture' | 'practice';

export interface Meeting {
  day: DayOfWeek;
  /** Minutes since midnight, inclusive. */
  startMin: number;
  /** Minutes since midnight, exclusive. */
  endMin: number;
  room: string;
  building: string;
  kind: MeetingKind;
}

/** A start and end datetime, kept as the API's string form. */
export interface DateRange {
  start: string;
  end: string;
}

/** Enrolled seats: a count when seats remain, or "full" when the section is full. */
export type Enrolled = number | 'full';

export interface Seats {
  /**
   * Seat capacity, or null when the section is uncapped. The API sends the
   * literal "-" for uncapped sections, which is refined to null here rather than
   * forced into a misleading number.
   */
  limit: number | null;
  preCount: number;
  queueLeft: number;
  enrolled: Enrolled;
}

export interface Exam {
  midterm?: DateRange;
  final?: DateRange;
  note?: string;
}

export interface Section {
  /** Primary key after deduplication. */
  teachTableId: string;
  subjectId: string;
  section: string;
  /**
   * Whether the section is a lecture or a practice, from lect_or_prac. It is
   * carried on the section, not only on its meetings, so an unscheduled section
   * with no meeting still shows the correct kind.
   */
  kind: MeetingKind;
  /** The paired section code from sec_pair, or null when the section is standalone. */
  pairedSection: string | null;
  meetings: Meeting[];
  teachersTh: string[];
  teachersEn: string[];
  seats: Seats;
  isClosed: boolean;
  exam: Exam;
  rulesTh: string;
  rulesEn: string;
  remark: string;
}

export interface Course {
  subjectId: string;
  nameTh: string;
  nameEn: string;
  credit: number;
  /** The combined credit string, for example "3(2-2-5)". */
  creditStr: string;
  /** The subject type heading the sections were grouped under. */
  groupNameTh: string;
  groupNameEn: string;
  sections: Section[];
}
