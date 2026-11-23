import { CalendarDays, ListChecks } from 'lucide-react';
import { useStore } from 'zustand';
import { onboardingStore } from '@/features/onboarding/onboardingStore';
import { planStore } from '@/features/plans/planStore';
import { needsLauncherAttention } from '@/lib/onboarding/launcherAttention';
import { fillTemplate } from '@/lib/i18n/template';
import { regisStore } from '@/features/regis/regisStore';
import {
  useCompanionRoute,
  useCompanionView,
} from '@/features/regis/useCompanion';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
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
// its transition apply only without a reduced motion preference. Until the panel first
// opens, a student with no stored plans sees a ring pulse twice around it once the
// welcome and the selector coach mark are out of the way (ADR-0063), and every student
// sees it after putting the coach mark off with Maybe later or Not again today
// (ADR-0072). It stays live under the coach mark, which spotlights it and leaves it
// clickable. On the two student registration pages it names the checklist and its
// progress and opens the registration helper dock instead of the overlay.

/** The launcher's id, so a layer that closes over it can hand it focus. */
export const LAUNCHER_ID = 'kcp-launcher';

/**
 * The launcher's box: its size comes from these classes and its face alone, so a layer
 * that must leave room for it, such as the coach mark, takes the same box and face.
 */
export const LAUNCHER_BOX =
  'inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold';

/** The launcher's icon and label, which with LAUNCHER_BOX give the launcher its size. */
export function LauncherFace() {
  const { t } = useTranslation();
  return (
    <>
      <CalendarDays size={20} strokeWidth={2} aria-hidden />
      <span>{t('launcher.label')}</span>
    </>
  );
}

/** On a registration page the launcher names the checklist and its progress instead. */
function CompanionLauncherFace() {
  const { t } = useTranslation();
  const { checklist } = useCompanionView();
  const total = checklist?.total ?? 0;
  return (
    <>
      <ListChecks size={20} strokeWidth={2} aria-hidden />
      <span>
        {total === 0
          ? t('regis.launcherEmpty')
          : fillTemplate(t('regis.launcher'), {
              done: checklist?.done ?? 0,
              total,
            })}
      </span>
    </>
  );
}

const LAUNCHER_CLASS = `fixed right-[max(20px,var(--kcp-safe-right))] bottom-[max(20px,var(--kcp-safe-bottom))] z-host ${LAUNCHER_BOX} bg-primary-strong text-white shadow-kcp hover:bg-primary-hover motion-safe:transition-[translate,background-color] motion-safe:duration-fast motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 ${FOCUS_OUTLINE}`;

// The welcome decision counts as part of the load, so the ring never starts in the
// moment before a welcome opens over it and then plays a second time after it closes.
function useLauncherAttention(welcomeOpen: boolean): boolean {
  const coachMarkOpen = useStore(
    onboardingStore,
    (state) => state.coachMarkOpen,
  );
  const onboardingSettled = useStore(
    onboardingStore,
    (state) => state.loaded && state.welcomeSettled,
  );
  const panelFirstOpenedAt = useStore(
    onboardingStore,
    (state) => state.record.panelFirstOpenedAt,
  );
  const coachMarkDismissed = useStore(
    onboardingStore,
    (state) => state.coachMarkDismissed,
  );
  const plansLoaded = useStore(planStore, (state) => state.loaded);
  const hasStoredPlans = useStore(planStore, (state) => state.plans.length > 0);
  return needsLauncherAttention({
    loaded: onboardingSettled && plansLoaded,
    record: { panelFirstOpenedAt },
    hasStoredPlans,
    welcomeOpen,
    coachMarkOpen,
    coachMarkDismissed,
  });
}

export function Launcher() {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const welcomeOpen = useStore(onboardingStore, (state) => state.welcomeOpen);
  // On the two student registration pages the launcher opens the registration helper
  // dock beside the page, and hides while the dock is open (ADR-0076).
  const companion = useCompanionRoute() !== null;
  const dockOpen = useStore(regisStore, (state) => state.dockOpen);
  const docked = companion && dockOpen;
  const covered = isOpen || welcomeOpen || docked;
  const openPanel = useStore(uiStore, (state) => state.open);
  const open = companion
    ? () => {
        regisStore.getState().setDockOpen(true);
      }
    : openPanel;
  const issueCount = useStore(uiStore, (state) => state.diagnosticsIssueCount);
  const attention = useLauncherAttention(welcomeOpen);
  const { t, language } = useTranslation();

  return (
    <button
      id={LAUNCHER_ID}
      type="button"
      onClick={open}
      inert={covered || undefined}
      aria-hidden={covered || undefined}
      aria-label={t(companion ? 'regis.launcherOpen' : 'launcher.open')}
      lang={language}
      className={`${LAUNCHER_CLASS}${attention ? ' kcp-launcher-ring' : ''}${docked ? ' invisible' : ''}`}
    >
      {companion ? <CompanionLauncherFace /> : <LauncherFace />}
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
