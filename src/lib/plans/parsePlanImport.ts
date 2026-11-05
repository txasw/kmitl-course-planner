// Parse an imported plan file at the trust boundary. The text is untrusted, so it
// passes JSON parsing and the plan schema before anything reaches the plan store. A
// failure returns the localized per field messages the import error view lists, and
// commits nothing. The schema strips keys it does not know, so an imported plan never
// carries state outside the plan model, such as review or notification records written
// on another device.

import { planSchema, type Plan } from '@/lib/domain/plan';
import { importIssueMessages } from '@/lib/domain/importIssues';
import type { Translate } from '@/lib/i18n/t';
import { err, ok, type Result } from '@/lib/utils/result';

/**
 * The validated plan from an imported file's text, or the localized messages that
 * explain why it was rejected: one message for text that is not JSON, otherwise one
 * per failing field with its path.
 */
export function parsePlanImport(
  text: string,
  t: Translate,
): Result<Plan, string[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return err([t('planData.invalidJson')]);
  }
  const result = planSchema.safeParse(parsed);
  if (!result.success) {
    return err(importIssueMessages(result.error, parsed, t));
  }
  return ok(result.data);
}
