// Pick the locale primary of a paired Thai and English string. Reference data and
// course names carry both languages, and some English fields are empty or even
// hold Thai text, so the primary falls back to the other language when it is
// empty. This is the single place that fallback rule lives.

import type { Locale } from './t';

export function pickLocalized(
  th: string | null | undefined,
  en: string | null | undefined,
  locale: Locale,
): string {
  const primary = locale === 'th' ? th : en;
  const secondary = locale === 'th' ? en : th;
  const chosen =
    primary !== null && primary !== undefined && primary.length > 0
      ? primary
      : secondary;
  return chosen ?? '';
}

/** A paired value in the locale primary, with the language of the field shown. */
export interface LocalizedValue<T> {
  value: T;
  lang: Locale;
}

/**
 * Pick the locale primary of a paired Thai and English value, falling back to the
 * other field when the primary is empty, like {@link pickLocalized}. It also reports
 * which language was shown, so the caller can set lang on the element and a fallback
 * line is never read with the wrong language's pronunciation.
 */
export function pickLocalizedWithLang<T extends string | readonly string[]>(
  th: T,
  en: T,
  locale: Locale,
): LocalizedValue<T> {
  const primary = locale === 'th' ? th : en;
  const secondary = locale === 'th' ? en : th;
  if (primary.length > 0 || secondary.length === 0) {
    return { value: primary, lang: locale };
  }
  return { value: secondary, lang: locale === 'th' ? 'en' : 'th' };
}
