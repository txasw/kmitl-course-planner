// The plan's exam timetable. Students share an exam schedule as often as a class
// timetable, and the plan already holds every midterm and final window, so this module
// arranges them: one group per exam kind, midterm before final, each a list of days in
// date order with one row per subject and window. A day with two or more subjects carries
// a same day count for a neutral note, a row records the subjects whose exam it collides
// with, and the subjects that announce no dated exam at all form the arranged by the
// instructor list. Only well formed windows are dated, the same reading the overlap gate
// applies, so a malformed window is never listed and never marks a clash. A row is tagged
// changed while the entry's open review holds an exam change.

import { snapshotToSection, type PlanEntry } from '../domain/plan';
import type { DateRange, Section } from '../domain/types';
import { WEEK_DAYS, type DayOfWeek } from '../parsing/days';
import { parseExamDateTime } from '../parsing/examDateTime';
import {
  EXAM_KINDS,
  isExamWindow,
  planExamConflicts,
  type ExamKind,
} from './examOverlap';

/** A subject of the plan as the exam schedule names it. */
export interface ExamSubject {
  subjectId: string;
  nameTh: string;
  nameEn: string;
  /** The plan's section codes this item covers, in numeric order. */
  sections: string[];
  /** Whether an open review of one of these sections holds an exam change. */
  changed: boolean;
}

/** Another placed subject whose exam of the same kind collides with a row, named by the
 * first of its sections that collides, so a pair that shares the window is listed once. */
export interface ExamClash {
  teachTableId: string;
  subjectId: string;
  section: string;
  nameTh: string;
  nameEn: string;
}

/** One subject's exam window of one kind. */
export interface ExamScheduleRow extends ExamSubject {
  window: DateRange;
  /** The API's exam detail text, or null when none of the sections carries one. */
  note: string | null;
  clashesWith: ExamClash[];
}

/** The rows that start on one calendar day, ordered by start time. */
export interface ExamDay {
  /** The day as "YYYY-MM-DD" in the Gregorian era the API stores. */
  date: string;
  yearCE: number;
  month: number;
  day: number;
  /** The day of the week, or null when the stored date is not a real calendar day. */
  weekday: DayOfWeek | null;
  rows: ExamScheduleRow[];
  /** The number of subjects examined that day when two or more are, otherwise null. */
  sameDayCount: number | null;
}

/** The dated exams of one kind. */
export interface ExamKindGroup {
  kind: ExamKind;
  days: ExamDay[];
}

export interface ExamSchedule {
  /** The kinds with at least one dated exam, midterm before final. */
  groups: ExamKindGroup[];
  /** The subjects with no dated exam of either kind, ordered by subject id. */
  selfArranged: ExamSubject[];
  /** Whether any row collides with another subject's exam. */
  hasClash: boolean;
}

interface Placed {
  entry: PlanEntry;
  section: Section;
}

const compareCodes = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true });

function examChanged(entry: PlanEntry): boolean {
  return entry.review?.kinds.includes('exam_changed') ?? false;
}

function subjectOf(placed: Placed): ExamSubject {
  const meta = placed.entry.snapshot.subjectMeta;
  return {
    subjectId: meta.subjectId,
    nameTh: meta.nameTh,
    nameEn: meta.nameEn,
    sections: [],
    changed: false,
  };
}

function addSection(item: ExamSubject, placed: Placed): void {
  item.sections.push(placed.section.section);
  item.sections.sort(compareCodes);
  item.changed ||= examChanged(placed.entry);
}

// The weekday is read from a UTC date built from the extracted fields rather than by
// parsing the string, which some engines misread. A field set that rolls over, such as
// the 30th of February, is not a real day and has no weekday.
function weekdayOf(
  yearCE: number,
  month: number,
  day: number,
): DayOfWeek | null {
  const date = new Date(Date.UTC(yearCE, month - 1, day));
  const real =
    date.getUTCFullYear() === yearCE &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return real ? (WEEK_DAYS[date.getUTCDay()] ?? null) : null;
}

/** The rows of one kind, one per subject and window, before they are grouped by day. */
function kindRows(
  placed: readonly Placed[],
  kind: ExamKind,
  clashes: ReturnType<typeof planExamConflicts>,
): ExamScheduleRow[] {
  const byId = new Map(placed.map((p) => [p.section.teachTableId, p]));
  const rows = new Map<string, ExamScheduleRow>();
  for (const item of placed) {
    const window = item.section.exam[kind];
    if (!isExamWindow(window)) {
      continue;
    }
    const key = `${item.section.subjectId} ${window.start} ${window.end}`;
    const row = rows.get(key) ?? {
      ...subjectOf(item),
      window,
      note: null,
      clashesWith: [],
    };
    rows.set(key, row);
    addSection(row, item);
    const note = item.section.exam.note?.trim() ?? '';
    row.note ??= note === '' ? null : note;
    for (const overlap of clashes.get(item.section.teachTableId) ?? []) {
      const other = byId.get(overlap.blocking.teachTableId);
      const known = row.clashesWith.some(
        (clash) => clash.subjectId === overlap.blocking.subjectId,
      );
      if (
        overlap.kind !== kind ||
        other === undefined ||
        overlap.blocking.subjectId === row.subjectId ||
        known
      ) {
        continue;
      }
      const { nameTh, nameEn } = other.entry.snapshot.subjectMeta;
      row.clashesWith.push({ ...overlap.blocking, nameTh, nameEn });
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.window.start.localeCompare(b.window.start) ||
      a.window.end.localeCompare(b.window.end) ||
      a.subjectId.localeCompare(b.subjectId),
  );
}

function groupByDay(rows: readonly ExamScheduleRow[]): ExamDay[] {
  const days: ExamDay[] = [];
  for (const row of rows) {
    const parts = parseExamDateTime(row.window.start);
    if (parts === null) {
      continue;
    }
    const date = row.window.start.slice(0, 10);
    const last = days.at(-1);
    if (last?.date === date) {
      last.rows.push(row);
      continue;
    }
    days.push({
      date,
      yearCE: parts.yearCE,
      month: parts.month,
      day: parts.day,
      weekday: weekdayOf(parts.yearCE, parts.month, parts.day),
      rows: [row],
      sameDayCount: null,
    });
  }
  for (const day of days) {
    const subjects = new Set(day.rows.map((row) => row.subjectId)).size;
    day.sameDayCount = subjects >= 2 ? subjects : null;
  }
  return days;
}

/** The subjects none of whose sections announces a dated exam of either kind. */
function selfArranged(placed: readonly Placed[]): ExamSubject[] {
  const subjects = new Map<string, ExamSubject>();
  const dated = new Set<string>();
  for (const item of placed) {
    const subject = subjects.get(item.section.subjectId) ?? subjectOf(item);
    subjects.set(item.section.subjectId, subject);
    addSection(subject, item);
    if (EXAM_KINDS.some((kind) => isExamWindow(item.section.exam[kind]))) {
      dated.add(item.section.subjectId);
    }
  }
  return [...subjects.values()]
    .filter((subject) => !dated.has(subject.subjectId))
    .sort((a, b) => a.subjectId.localeCompare(b.subjectId));
}

/** Arrange a plan's entries into its exam schedule. */
export function buildExamSchedule(entries: readonly PlanEntry[]): ExamSchedule {
  const placed = entries.map((entry) => ({
    entry,
    section: snapshotToSection(entry.snapshot),
  }));
  const clashes = planExamConflicts(placed.map((item) => item.section));
  const groups: ExamKindGroup[] = [];
  let hasClash = false;
  for (const kind of EXAM_KINDS) {
    const rows = kindRows(placed, kind, clashes);
    hasClash ||= rows.some((row) => row.clashesWith.length > 0);
    const days = groupByDay(rows);
    if (days.length > 0) {
      groups.push({ kind, days });
    }
  }
  return { groups, selfArranged: selfArranged(placed), hasClash };
}
