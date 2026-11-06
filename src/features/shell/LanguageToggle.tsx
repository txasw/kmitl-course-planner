import { useStore } from 'zustand';
import type { Locale } from '@/lib/i18n/t';
import { SegmentedControl } from '@/components/SegmentedControl';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

// The UI language toggle. It writes the choice to the ui store; the App persists
// the change. Built on the shared segmented control so it behaves like the mode
// toggle, in the quiet variant, because a language is a setting rather than the view
// state the filled mode toggle carries.
export function LanguageToggle() {
  const language = useStore(uiStore, (state) => state.language);
  const setLanguage = useStore(uiStore, (state) => state.setLanguage);
  const { t } = useTranslation();

  const options: readonly { value: Locale; label: string }[] = [
    { value: 'th', label: t('language.th') },
    { value: 'en', label: t('language.en') },
  ];

  return (
    <SegmentedControl
      ariaLabel={t('language.select')}
      value={language}
      options={options}
      onChange={setLanguage}
      variant="quiet"
    />
  );
}
