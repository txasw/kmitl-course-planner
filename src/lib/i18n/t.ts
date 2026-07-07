// Minimal typed dictionary. th.json is the source of truth for the key set, and
// the TABLES annotation forces en.json to cover exactly those keys, so a missing
// translation is a compile error. A runtime parity test guards against extra
// keys drifting into either file. No i18n framework is pulled in; see ADR-0017.

import th from './th.json';
import en from './en.json';

export type Locale = 'th' | 'en';

/** Every translatable key, derived from the Thai dictionary. */
export type TranslationKey = keyof typeof th;

// Typing both dictionaries as the same record makes a key missing from either
// file fail typechecking. Extra keys are caught by the parity test at runtime.
const TABLES: Record<Locale, Record<TranslationKey, string>> = { th, en };

/** The default UI locale per the brief. */
export const DEFAULT_LOCALE: Locale = 'th';

/** A function that resolves a key to its string in one locale. */
export type Translate = (key: TranslationKey) => string;

/** Returns a translator bound to one locale. */
export function createTranslator(locale: Locale): Translate {
  const table = TABLES[locale];
  return (key) => table[key];
}
