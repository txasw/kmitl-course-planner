// Parse the API `credit_lps` field into a subject's weekly hours.
//
// `credit_lps` is the lecture, practice, and self study triple of the Thai credit
// notation, for example `(2-3-6)`: two hours of lecture, three of practice, and six of
// self study each week. `credit_str` is the same triple behind the credit count, for
// example `3(2-3-6)`, and it is the form a plan snapshot keeps, so the parser accepts
// both. Every value in the captured fixtures uses whole hours, and some reach two digits
// such as `(0-45-0)` for a practicum, so each part is one or more digits. A decimal part
// is accepted too because the notation allows half hours. Anything else returns null,
// which a caller reads as no breakdown to show rather than a fault.

/** The weekly hours one credit triple describes. */
export interface CreditHours {
  lecture: number;
  practice: number;
  selfStudy: number;
}

const HOURS = '(\\d+(?:\\.\\d+)?)';

const CREDIT_LPS_PATTERN = new RegExp(
  `^(?:\\d+(?:\\.\\d+)?)?\\(${HOURS}-${HOURS}-${HOURS}\\)$`,
);

/**
 * Parse `(L-P-S)` or `C(L-P-S)` into lecture, practice, and self study hours, or null
 * when the value does not follow the notation.
 */
export function parseCreditLps(raw: string): CreditHours | null {
  const match = CREDIT_LPS_PATTERN.exec(raw.trim());
  if (match === null) {
    return null;
  }
  return {
    lecture: Number(match[1]),
    practice: Number(match[2]),
    selfStudy: Number(match[3]),
  };
}
