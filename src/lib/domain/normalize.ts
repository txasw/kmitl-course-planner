// The normalization pipeline: validate, flatten, sanitize, deduplicate, parse,
// group, and link pairs. Every step is a pure function. The pipeline turns one
// untrusted teach table response into a deduplicated list of Course objects, a
// duplicate count for diagnostics, and a list of per row warnings for rows whose
// day or time could not be parsed. A shape that fails validation returns a typed
// error; a single malformed row never crashes the whole result.

import { isUnscheduledRow, parseTeachDay } from '../parsing/days';
import { parseTimeToMinutes } from '../parsing/time';
import { parseTeachTimeStr } from '../parsing/teachTimeStr';
import { isExamDateTime } from '../parsing/examDateTime';
import { sanitizeToLines } from '../parsing/sanitize';
import { ok, type Result, type ValidationError } from '../utils/result';
import {
  validate,
  teachTableResponseSchema,
  FULL_MARKER,
  type RawSectionRow,
  type RawTeachTableResponse,
} from './schemas';
import type {
  Course,
  Enrolled,
  Exam,
  Meeting,
  MeetingKind,
  Section,
} from './types';

/** A row whose day or time could not be parsed into a meeting. */
export interface NormalizationWarning {
  teachTableId: string;
  subjectId: string;
  section: string;
  reason: string;
}

export interface NormalizedCatalog {
  courses: Course[];
  /** Raw rows dropped as duplicates of an already seen teach_table_id. */
  duplicateCount: number;
  /** Sections that carry more than one meeting, from teachtime_str extras. */
  multiMeetingCount: number;
  warnings: NormalizationWarning[];
}

interface TaggedRow {
  row: RawSectionRow;
  groupNameTh: string;
  groupNameEn: string;
}

function flatten(response: RawTeachTableResponse): TaggedRow[] {
  const rows: TaggedRow[] = [];
  for (const group of response) {
    for (const block of group.teachtable) {
      for (const row of block.data) {
        rows.push({
          row,
          groupNameTh: block.subject_type_name_th,
          groupNameEn: block.subject_type_name_en,
        });
      }
    }
  }
  return rows;
}

function dedupe(rows: TaggedRow[]): {
  unique: TaggedRow[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const unique: TaggedRow[] = [];
  for (const tagged of rows) {
    if (seen.has(tagged.row.teach_table_id)) {
      continue;
    }
    seen.add(tagged.row.teach_table_id);
    unique.push(tagged);
  }
  return { unique, duplicateCount: rows.length - unique.length };
}

function parseCredit(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function parseLimit(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

function parseEnrolled(count: number | typeof FULL_MARKER): Enrolled {
  return typeof count === 'number' ? count : 'full';
}

function pickRoom(row: RawSectionRow): string {
  return row.room_no ?? row.classroom ?? '';
}

function pickBuilding(row: RawSectionRow): string {
  return row.building_no ?? row.classbuilding ?? '';
}

/** Lecture or practice from the raw lect_or_prac marker; ป is practice. */
function parseKind(lectOrPrac: string): MeetingKind {
  return lectOrPrac === 'ป' ? 'practice' : 'lecture';
}

// The exam datetime fields are kept nullable at the schema boundary so one malformed
// value never blanks the catalog during registration season; the format authority lives
// here and in the contract auditor. A non null value that fails the format is still stored
// on the snapshot but is treated as no window by the overlap gate, and it is recorded as a
// per row warning so an exam silently losing its format is distinguishable from an exam
// that was never announced (a null field). A null field records nothing.
function warnMalformedExamField(
  row: RawSectionRow,
  value: string | null,
  label: string,
  warnings: NormalizationWarning[],
): void {
  if (value !== null && !isExamDateTime(value)) {
    warnings.push({
      teachTableId: row.teach_table_id,
      subjectId: row.subject_id,
      section: row.section,
      reason: `${label} is not a valid datetime`,
    });
  }
}

function toExam(row: RawSectionRow, warnings: NormalizationWarning[]): Exam {
  const exam: Exam = {};
  warnMalformedExamField(
    row,
    row.midterm_start_date_time,
    'midterm start',
    warnings,
  );
  warnMalformedExamField(
    row,
    row.midterm_end_date_time,
    'midterm end',
    warnings,
  );
  warnMalformedExamField(
    row,
    row.final_start_date_time,
    'final start',
    warnings,
  );
  warnMalformedExamField(row, row.final_end_date_time, 'final end', warnings);
  if (
    row.midterm_start_date_time !== null &&
    row.midterm_end_date_time !== null
  ) {
    exam.midterm = {
      start: row.midterm_start_date_time,
      end: row.midterm_end_date_time,
    };
  }
  if (row.final_start_date_time !== null && row.final_end_date_time !== null) {
    exam.final = {
      start: row.final_start_date_time,
      end: row.final_end_date_time,
    };
  }
  if (row.exam_text_detail !== null) {
    exam.note = row.exam_text_detail;
  }
  return exam;
}

/** Build the single meeting for a row, or record why it could not be built. */
function toMeeting(row: RawSectionRow): Meeting | { reason: string } {
  const day = parseTeachDay(row.teach_day);
  if (day === null) {
    return { reason: `teach_day out of range: "${row.teach_day}"` };
  }
  const startMin = parseTimeToMinutes(row.teach_time);
  const endMin = parseTimeToMinutes(row.teach_time2);
  if (startMin === null || endMin === null) {
    return { reason: 'teach_time or teach_time2 not parseable' };
  }
  if (endMin <= startMin) {
    return { reason: 'end time is not after start time' };
  }
  return {
    day,
    startMin,
    endMin,
    room: pickRoom(row),
    building: pickBuilding(row),
    kind: parseKind(row.lect_or_prac),
  };
}

/** Drop exact duplicate meetings, keeping the first, ordered by day then start. */
function dedupeMeetings(meetings: Meeting[]): Meeting[] {
  const seen = new Set<string>();
  const unique: Meeting[] = [];
  for (const meeting of meetings) {
    const key = `${String(meeting.day)}:${String(meeting.startMin)}-${String(meeting.endMin)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(meeting);
  }
  return unique.sort((a, b) => a.day - b.day || a.startMin - b.startMin);
}

function warnRow(
  row: RawSectionRow,
  reason: string,
  warnings: NormalizationWarning[],
): void {
  warnings.push({
    teachTableId: row.teach_table_id,
    subjectId: row.subject_id,
    section: row.section,
    reason,
  });
}

function toSection(
  tagged: TaggedRow,
  warnings: NormalizationWarning[],
): Section {
  const { row } = tagged;
  const meetings: Meeting[] = [];
  const unscheduled = isUnscheduledRow(
    row.teach_day,
    row.teach_time,
    row.teach_time2,
  );
  // The primary meeting comes from teach_day, teach_time, and teach_time2. An
  // unscheduled row, an online or asynchronous course, legitimately carries no
  // primary meeting. It is an expected state, not a malformed row, so it records
  // no warning; only a genuinely unparseable day or time does. A day 0 row that
  // still carries real times is not unscheduled and falls through to the warning
  // path.
  if (!unscheduled) {
    const meeting = toMeeting(row);
    if ('reason' in meeting) {
      warnRow(row, meeting.reason, warnings);
    } else {
      meetings.push(meeting);
    }
  }
  // Additional meetings are packed into teachtime_str, not into separate rows.
  // They carry no room, building, or kind of their own, so they inherit the row's.
  // A malformed segment surfaces as a warning rather than a silently lost meeting,
  // and the primary still renders. An unscheduled row that nonetheless carries
  // teachtime_str meetings is an undocumented mixed shape: the real meetings are
  // kept and the mix is warned.
  const extra = parseTeachTimeStr(row.teachtime_str);
  for (const meeting of extra.meetings) {
    meetings.push({
      ...meeting,
      room: pickRoom(row),
      building: pickBuilding(row),
      kind: parseKind(row.lect_or_prac),
    });
  }
  if (extra.malformed) {
    warnRow(
      row,
      `teachtime_str has an unparseable segment: "${row.teachtime_str ?? ''}"`,
      warnings,
    );
  }
  if (unscheduled && extra.meetings.length > 0) {
    warnRow(row, 'unscheduled row carries teachtime_str meetings', warnings);
  }
  return {
    teachTableId: row.teach_table_id,
    subjectId: row.subject_id,
    section: row.section,
    kind: parseKind(row.lect_or_prac),
    pairedSection: row.sec_pair,
    meetings: dedupeMeetings(meetings),
    teachersTh: sanitizeToLines(row.teacher_list_th),
    teachersEn: sanitizeToLines(row.teacher_list_en),
    seats: {
      limit: parseLimit(row.limit),
      preCount: row.pre_count,
      queueLeft: row.queue_left,
      enrolled: parseEnrolled(row.count),
    },
    isClosed: row.closed === '1',
    exam: toExam(row, warnings),
    rulesTh: sanitizeToLines(row.rules_th).join('\n'),
    rulesEn: sanitizeToLines(row.rules_en).join('\n'),
    remark: row.remark,
  };
}

function bySectionCode(a: Section, b: Section): number {
  return a.section.localeCompare(b.section, undefined, { numeric: true });
}

export function normalizeTeachTable(
  raw: unknown,
): Result<NormalizedCatalog, ValidationError> {
  const validated = validate(teachTableResponseSchema, raw);
  if (!validated.ok) {
    return validated;
  }

  const { unique, duplicateCount } = dedupe(flatten(validated.value));
  const warnings: NormalizationWarning[] = [];
  const meta = new Map<string, TaggedRow>();
  const sectionsBySubject = new Map<string, Section[]>();

  for (const tagged of unique) {
    const section = toSection(tagged, warnings);
    if (!meta.has(section.subjectId)) {
      meta.set(section.subjectId, tagged);
    }
    const existing = sectionsBySubject.get(section.subjectId);
    if (existing) {
      existing.push(section);
    } else {
      sectionsBySubject.set(section.subjectId, [section]);
    }
  }

  const courses: Course[] = [];
  let multiMeetingCount = 0;
  for (const [subjectId, tagged] of meta) {
    const sections = (sectionsBySubject.get(subjectId) ?? []).sort(
      bySectionCode,
    );
    for (const section of sections) {
      if (section.meetings.length > 1) {
        multiMeetingCount += 1;
      }
    }
    courses.push({
      subjectId,
      nameTh: tagged.row.subject_name_th,
      nameEn: tagged.row.subject_name_en,
      credit: parseCredit(tagged.row.credit),
      creditStr: tagged.row.credit_str,
      groupNameTh: tagged.groupNameTh,
      groupNameEn: tagged.groupNameEn,
      sections,
    });
  }

  return ok({ courses, duplicateCount, multiMeetingCount, warnings });
}
