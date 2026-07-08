// Parse the API `teach_time` and `teach_time2` strings into minutes since
// midnight. The grid derives every placement from minutes, never from pixels, so
// this is the single conversion point from the wire format.

const TIME_PATTERN = /^(\d{2}):(\d{2}):(\d{2})$/;

/**
 * Convert an `HH:MM:SS` string to minutes since midnight, or null when the value
 * is not a well formed 24 hour time. Seconds are validated but do not contribute
 * to the result, since meetings sit on minute boundaries.
 */
export function parseTimeToMinutes(raw: string): number | null {
  const match = TIME_PATTERN.exec(raw);
  if (match === null) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Format minutes since midnight as a zero padded HH:MM label for display. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
