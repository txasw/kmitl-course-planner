import { CalendarDays } from 'lucide-react';
import { useStore } from 'zustand';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

// Floating launcher shown on every host route. It opens the overlay and, while
// the overlay is open, becomes inert and hidden from assistive technology so the
// modal is the only interactive surface. It stays mounted so focus returns here
// when the overlay closes.
export function Launcher() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const open = useStore(uiStore, (state) => state.open);
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={open}
      inert={isOpen || undefined}
      aria-hidden={isOpen || undefined}
      aria-label={t('launcher.open')}
      className="fixed right-5 bottom-5 z-[2147483646] inline-flex items-center gap-2 rounded-kcp bg-primary px-4 py-3 text-sm font-semibold text-white shadow-kcp outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <CalendarDays size={18} strokeWidth={2} aria-hidden />
      <span>{t('launcher.label')}</span>
    </button>
  );
}
