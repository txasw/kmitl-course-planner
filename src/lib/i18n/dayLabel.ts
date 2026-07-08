// The one place a numeric DayOfWeek maps to its translation key, shared by the
// catalog and the timetable so the mapping never forks.

import type { DayOfWeek } from '../domain/types';
import type { TranslationKey } from './t';

const DAY_KEYS: Record<DayOfWeek, TranslationKey> = {
  0: 'day.0',
  1: 'day.1',
  2: 'day.2',
  3: 'day.3',
  4: 'day.4',
  5: 'day.5',
  6: 'day.6',
};

/** The short day abbreviation key, for dense rows and grid labels. */
export function dayLabelKey(day: DayOfWeek): TranslationKey {
  return DAY_KEYS[day];
}
