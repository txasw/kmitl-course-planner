// The one place a calendar month number maps to its translation key, so the exam date
// formatter reads a localized month name without forking the mapping. Months are 1 through
// 12; the key resolves to a Thai or English abbreviation per the active locale.

import type { TranslationKey } from './t';

const MONTH_KEYS: Record<number, TranslationKey> = {
  1: 'month.1',
  2: 'month.2',
  3: 'month.3',
  4: 'month.4',
  5: 'month.5',
  6: 'month.6',
  7: 'month.7',
  8: 'month.8',
  9: 'month.9',
  10: 'month.10',
  11: 'month.11',
  12: 'month.12',
};

/** The abbreviated month name key for a month number 1 through 12. */
export function monthKey(month: number): TranslationKey | null {
  return MONTH_KEYS[month] ?? null;
}
