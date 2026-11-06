import { CalendarDays } from 'lucide-react';
import { useStore } from 'zustand';
import { onboardingStore } from '@/features/onboarding/onboardingStore';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

// Floating launcher shown on every host route. It opens the overlay and, while
// the overlay or the welcome is open, becomes inert and hidden from assistive
// technology so the modal is the only interactive surface. It stays mounted so
// focus returns here when the overlay closes. It sits outside the overlay root,
// so it carries the panel language itself rather than inheriting the host
// document's. It keeps its 20 px offset from the corner, or the device safe area
// inset where that is larger. It is a fully rounded pill in the strong primary
// colour, 48 px tall at least, and lifts 2 px on hover and keyboard focus through a
// transform only, since one shadow level serves the overlay and popovers. The lift and
// its transition apply only without a reduced motion preference (ADR-0063).

/** The launcher's id, so a layer that closes over it can hand it focus. */
export const LAUNCHER_ID = 'kcp-launcher';

export function Launcher() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const welcomeOpen = useStore(onboardingStore, (state) => state.welcomeOpen);
  const covered = isOpen || welcomeOpen;
  const open = useStore(uiStore, (state) => state.open);
  const issueCount = useStore(uiStore, (state) => state.diagnosticsIssueCount);
  const { t, language } = useTranslation();

  return (
    <button
      id={LAUNCHER_ID}
      type="button"
      onClick={open}
      inert={covered || undefined}
      aria-hidden={covered || undefined}
      aria-label={t('launcher.open')}
      lang={language}
      className="fixed right-[max(20px,var(--kcp-safe-right))] bottom-[max(20px,var(--kcp-safe-bottom))] z-host inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-strong px-5 py-3 text-sm font-semibold text-white shadow-kcp outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-safe:transition-[translate,background-color] motion-safe:duration-fast motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5"
    >
      <CalendarDays size={20} strokeWidth={2} aria-hidden />
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
