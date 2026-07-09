// A filesystem safe slug for export file names. Thai letters and alphanumerics
// are kept as is; every other character, including whitespace and the reserved
// filename characters (\ / : * ? " < > | and control characters), separates runs
// and becomes a single hyphen. Leading, trailing, and repeated hyphens cannot
// occur because only kept runs are joined. Returns an empty string when nothing
// survives, so the caller can fall back to a stable identifier such as the plan
// id rather than producing a nameless file.

/**
 * Runs of characters kept verbatim: digits, ASCII letters, and the Thai block
 * (U+0E00 through U+0E7F).
 */
const KEPT_RUN = /[0-9A-Za-z฀-๿]+/gu;

/** A hyphen joined slug of the kept runs, or an empty string when none survive. */
export function slug(value: string): string {
  const runs = value.match(KEPT_RUN);
  return runs === null ? '' : runs.join('-');
}
