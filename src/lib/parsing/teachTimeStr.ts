// Parse the API `teachtime_str` field into a section's additional meetings.
//
// The teach table API does not emit one row per meeting. A section's extra class
// periods are packed into `teachtime_str` as a comma separated list of
// `<day>x<H:MM>-<H:MM>` segments, where the day uses the same 1 through 7 basis
// as `teach_day` and may differ from it. The primary meeting stays in the
// `teach_day`, `teach_time`, and `teach_time2` fields; `teachtime_str` carries
// only the extras. Section 4.1 of the brief said not to depend on this field,
// which is exactly why the extra periods were dropped. ADR-0037 records the
// census that fixed the grammar and the correction.

import { parseTeachDay, type DayOfWeek } from './days';

// The body of one segment, anchorless, with capture groups for the day and the
// four time digits. Both the single segment matcher and the whole value pattern
// are built from this one source so the grammar has a single home and the parser
// and the contract auditor cannot fork.
const SEGMENT_SOURCE = '([1-7])x(\\d{1,2}):(\\d{2})-(\\d{1,2}):(\\d{2})';

/** Matches one `<day>x<H:MM>-<H:MM>` segment, capturing day and time digits. */
export const TEACH_TIME_STR_SEGMENT = new RegExp(`^${SEGMENT_SOURCE}$`);

/**
 * Matches a whole `teachtime_str` value: empty, or one or more segments joined by
 * commas. The contract auditor imports this as the field's format expectation.
 * The empty alternative is required because the auditor tests non null strings and
 * the field is the empty string on most rows.
 */
export const TEACH_TIME_STR_PATTERN = new RegExp(
  `^(|${SEGMENT_SOURCE}(,${SEGMENT_SOURCE})*)$`,
);

/** A parsed extra meeting: day and minute bounds, without room, building, or kind. */
export interface TeachTimeStrMeeting {
  day: DayOfWeek;
  startMin: number;
  endMin: number;
}

export interface TeachTimeStrResult {
  meetings: TeachTimeStrMeeting[];
  /** True when at least one non empty segment could not be parsed. */
  malformed: boolean;
}

/** Convert an `H:MM` or `HH:MM` clock pair to minutes, or null when out of range. */
function clockToMinutes(hh: string, mm: string): number | null {
  const hours = Number(hh);
  const minutes = Number(mm);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Parse a raw `teachtime_str` into its additional meetings. A null or empty value
 * yields no meetings and is not a fault. Any segment that fails the grammar, the
 * time range, or the end after start rule is skipped and flags `malformed`, so a
 * format drift surfaces as a per row warning rather than silently costing a
 * meeting; valid segments in the same value are still returned.
 */
export function parseTeachTimeStr(raw: string | null): TeachTimeStrResult {
  if (raw === null || raw.trim() === '') {
    return { meetings: [], malformed: false };
  }
  const meetings: TeachTimeStrMeeting[] = [];
  let malformed = false;
  for (const rawSegment of raw.split(',')) {
    const match = TEACH_TIME_STR_SEGMENT.exec(rawSegment.trim());
    if (match === null) {
      malformed = true;
      continue;
    }
    const [, dayStr, startH, startM, endH, endM] = match;
    if (
      dayStr === undefined ||
      startH === undefined ||
      startM === undefined ||
      endH === undefined ||
      endM === undefined
    ) {
      malformed = true;
      continue;
    }
    const day = parseTeachDay(dayStr);
    const startMin = clockToMinutes(startH, startM);
    const endMin = clockToMinutes(endH, endM);
    if (
      day === null ||
      startMin === null ||
      endMin === null ||
      endMin <= startMin
    ) {
      malformed = true;
      continue;
    }
    meetings.push({ day, startMin, endMin });
  }
  return { meetings, malformed };
}
