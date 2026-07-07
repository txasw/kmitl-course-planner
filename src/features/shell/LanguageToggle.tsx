import { useStore } from 'zustand';
import type { Locale } from '@/lib/i18n/t';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

// A two option segmented control for the UI language. It writes the choice to
// the ui store; the App persists the change to storage. The active option is
// marked with aria-pressed so the state is conveyed without relying on color.
export function LanguageToggle() {
  const language = useStore(uiStore, (state) => state.language);
  const setLanguage = useStore(uiStore, (state) => state.setLanguage);
  const { t } = useTranslation();

  const options: readonly { value: Locale; label: string }[] = [
    { value: 'th', label: t('language.th') },
    { value: 'en', label: t('language.en') },
  ];

  return (
    <div
      role="group"
      aria-label={t('language.select')}
      className="inline-flex rounded-kcp border border-border p-0.5"
    >
      {options.map((option) => {
        const active = option.value === language;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setLanguage(option.value);
            }}
            className={`rounded-[6px] px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
