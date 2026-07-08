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
