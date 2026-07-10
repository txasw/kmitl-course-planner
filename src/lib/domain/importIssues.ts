// Turn a plan schema validation error into localized per field messages for the import
// rejection. Each message keeps the technical field path so the user can find the
// offending field, and drops the validation library's English phrasing for a short
// localized reason. A missing field cannot be told from a wrong typed or out of enum one
// by the issue code alone, because a missing string is an invalid_type and a missing enum
// is an invalid_value, the same codes a present but wrong value produces. So the value at
// the path decides: an absent value is missing, a present one keeps its code's reason.
// The only custom refine on the plan schema is the term invariant, so a custom issue is a
// term mismatch.

import type { ZodError } from 'zod';
import type { Translate, TranslationKey } from '@/lib/i18n/t';

const CODE_KEY: Record<string, TranslationKey> = {
  invalid_type: 'planData.issue.wrongType',
  invalid_value: 'planData.issue.invalidValue',
  custom: 'planData.issue.termMismatch',
};

// Codes whose issue is raised for both an absent field and a present but wrong one, so a
// presence check on the parsed blob decides which of the two it is.
const PRESENCE_CODES = new Set(['invalid_type', 'invalid_value']);

/** The value at a path in the parsed blob, or undefined when the path is absent. */
function valueAtPath(input: unknown, path: readonly PropertyKey[]): unknown {
  let current = input;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function issueKey(code: string, missing: boolean): TranslationKey {
  if (missing) {
    return 'planData.issue.required';
  }
  return CODE_KEY[code] ?? 'planData.issue.malformed';
}

/**
 * Localized per field messages for a rejected plan import, each keeping the field path.
 * `input` is the parsed blob, so a missing field reads as missing rather than as a wrong
 * type or an out of enum value. A root level issue with no path returns the message alone.
 */
export function importIssueMessages(
  error: ZodError,
  input: unknown,
  t: Translate,
): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    const missing =
      PRESENCE_CODES.has(issue.code) &&
      valueAtPath(input, issue.path) === undefined;
    const message = t(issueKey(issue.code, missing));
    return path === '' ? message : `${path}: ${message}`;
  });
}
