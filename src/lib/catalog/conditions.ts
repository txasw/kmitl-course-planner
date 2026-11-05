// The enrollment conditions and the remark of a section, read as display lines. Both
// reach the section as sanitized plain text with one entry per line: normalization
// joins the rule list with newlines and splits the remark at its block boundaries. A
// row, the unscheduled shelf, and the detail list all read them through here, so the
// line split and the locale fallback for the paired rule fields live in one place.

import type { Locale } from '../i18n/t';
import { pickLocalizedWithLang, type LocalizedValue } from '../i18n/localize';

/** The non empty, trimmed lines of a sanitized multi line text field. */
export function textLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * The condition lines in the locale primary, one per rule, with the language of the
 * field shown. The Thai and English rule lists are not always both filled, so an
 * empty primary falls back to the other language rather than hiding the conditions.
 */
export function conditionLines(
  rulesTh: string,
  rulesEn: string,
  locale: Locale,
): LocalizedValue<string[]> {
  return pickLocalizedWithLang(textLines(rulesTh), textLines(rulesEn), locale);
}
