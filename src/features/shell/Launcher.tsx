import { CalendarDays } from 'lucide-react';
import { useStore } from 'zustand';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

// Floating launcher shown on every host route. It opens the overlay and, while
// the overlay is open, becomes inert and hidden from assistive technology so the
// modal is the only interactive surface. It stays mounted so focus returns here
// when the overlay closes. It sits outside the overlay root, so it carries the
// panel language itself rather than inheriting the host document's. It keeps its 20 px
// offset from the corner, or the device safe area inset where that is larger.
export function Launcher() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const open = useStore(uiStore, (state) => state.open);
  const issueCount = useStore(uiStore, (state) => state.diagnosticsIssueCount);
  const { t, language } = useTranslation();

  return (
    <button
      type="button"
      onClick={open}
      inert={isOpen || undefined}
      aria-hidden={isOpen || undefined}
      aria-label={t('launcher.open')}
      lang={language}
      className="fixed right-[max(20px,var(--kcp-safe-right))] bottom-[max(20px,var(--kcp-safe-bottom))] z-host inline-flex items-center gap-2 rounded-kcp bg-primary-strong px-4 py-3 text-sm font-semibold text-white shadow-kcp outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <CalendarDays size={18} strokeWidth={2} aria-hidden />
      <span>{t('launcher.label')}</span>
      {issueCount !== null && issueCount > 0 ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white"
        >
          {issueCount}
        </span>
      ) : null}
    </button>
  );
}
