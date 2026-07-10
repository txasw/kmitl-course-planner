// Turn a plan schema validation error into localized per field messages for the import
// rejection. Each message keeps the technical field path so the user can find the
// offending field, and drops the validation library's English phrasing for a short
// localized reason. A missing field and a wrong typed field both surface as the same
// invalid_type issue, so the value at the path decides between them: an absent value is
// missing, a present one is the wrong type. The only custom refine on the plan schema is
// the term invariant, so a custom issue is a term mismatch.

import type { ZodError } from 'zod';
import type { Translate, TranslationKey } from '@/lib/i18n/t';

const CODE_KEY: Record<string, TranslationKey> = {
  invalid_value: 'planData.issue.invalidValue',
  custom: 'planData.issue.termMismatch',
};

/** The value at a dotted path in the parsed blob, or undefined when the path is absent. */
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
  if (code === 'invalid_type') {
    return missing ? 'planData.issue.required' : 'planData.issue.wrongType';
  }
  return CODE_KEY[code] ?? 'planData.issue.malformed';
}

/**
 * Localized per field messages for a rejected plan import, each keeping the field path.
 * `input` is the parsed blob, so a missing field reads as missing rather than as a wrong
 * type. A root level issue with no path returns the message alone.
 */
export function importIssueMessages(
  error: ZodError,
  input: unknown,
  t: Translate,
): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    const missing =
      issue.code === 'invalid_type' &&
      valueAtPath(input, issue.path) === undefined;
    const message = t(issueKey(issue.code, missing));
    return path === '' ? message : `${path}: ${message}`;
  });
}
