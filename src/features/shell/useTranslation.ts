// React binding for the i18n layer. It subscribes to the ui store language and
// returns a translator plus the active locale, so components read strings
// through t() and re-render when the language toggles.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createTranslator, type Locale, type Translate } from '@/lib/i18n/t';
import { uiStore } from './uiStore';

export function useTranslation(): { t: Translate; language: Locale } {
  const language = useStore(uiStore, (state) => state.language);
  const t = useMemo(() => createTranslator(language), [language]);
  return { t, language };
}
