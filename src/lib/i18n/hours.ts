// An hour count with its unit for the plan summaries. Thai sets the abbreviation apart
// with a space (6 ชม.) and English joins it to the number (6h). The separator is chosen
// here per locale rather than written into the dictionaries, where a leading space is
// invisible in review and easy to lose.

import { formatHours } from '@/lib/parsing/time';
import type { Locale, Translate } from './t';

const HOUR_UNIT_SEPARATOR: Record<Locale, string> = { th: ' ', en: '' };

/** A duration in minutes as hours with the locale's unit, for example 6 ชม. or 6h. */
export function hoursText(
  minutes: number,
  locale: Locale,
  t: Translate,
): string {
  return `${formatHours(minutes)}${HOUR_UNIT_SEPARATOR[locale]}${t('footer.hourUnit')}`;
}
