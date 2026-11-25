import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ListChecks,
  LoaderCircle,
} from 'lucide-react';
import { useStore } from 'zustand';
import { onboardingStore } from '@/features/onboarding/onboardingStore';
import { planStore } from '@/features/plans/planStore';
import { needsLauncherAttention } from '@/lib/onboarding/launcherAttention';
import { fillTemplate } from '@/lib/i18n/template';
import {
  CARD_ID,
  COUNT_ID,
  STOP_ID,
  chooseCollapsed,
  helperStore,
  markReady,
} from '@/features/regis/helperStore';
import { useCompanionRoute } from '@/features/regis/useCompanion';
import { useHelperModel } from '@/features/regis/useHelperModel';
import { commitThenFocus, focusFirst } from './restoreFocus';
import { rootOf } from './useFocusTrap';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';

// Floating launcher shown on every host route. It opens the overlay and, while
// the overlay or the welcome is open, becomes inert and hidden from assistive
// technology so the modal is the only interactive surface. It stays mounted so
// focus returns here when the overlay closes. It sits outside the overlay root,
// so it carries the panel language itself rather than inheriting the host
// document's. It keeps its 20 px offset from the corner, or the device safe area
// inset where that is larger, from the corner of the part of the page on screen on a
// helper page (HelperViewport). It is a fully rounded pill in the strong primary
// colour, 48 px tall at least, and lifts 2 px on hover and keyboard focus through a
// transform only, since one shadow level serves the overlay and popovers. The lift and
// its transition apply only without a reduced motion preference. Until the panel first
// opens, a student with no stored plans sees a ring pulse twice around it once the
// welcome and the selector coach mark are out of the way (ADR-0063), and every student
// sees it after putting the coach mark off with Maybe later or Not again today
// (ADR-0072). It stays live under the coach mark, which spotlights it and leaves it
// clickable. On the two student registration pages it names the checklist and its
// progress and toggles the registration helper card above it instead of opening the
// overlay (ADR-0076, design C2). It stays orange and in place while the card is open, with
// a chevron that collapses it, outside a fill run, and no count, since the card's header
// shows the count;
// collapsed, it shows the count, a loader while a fill run adds a
// subject, a check once every subject is added, and a dot when a subject needs a look.

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
function useCompanionFace(open: boolean) {
  const { t } = useTranslation();
  const model = useHelperModel();
  const busy = model.run.status === 'running';
  // A plan the helper shows without having read the page term may be of another term, and
  // folded on a phone the launcher has no room for the card's label of that plan's term,
  // so it shows a count only for a plan of the term read from the page.
  const confirmed = model.pick.kind === 'plan' && model.pick.confirmed;
  const complete = confirmed && model.total > 0 && model.done === model.total;
  // While the card is open its header carries the count, so the launcher names the
  // checklist alone and the same count never shows twice.
  const progress =
    model.total === 0 || open || !confirmed
      ? t('regis.launcherEmpty')
      : fillTemplate(t('regis.launcher'), {
          done: model.done,
          total: model.total,
        });
  const dot = !open && model.attention;
  const Icon =
    busy && !open ? LoaderCircle : complete ? CircleCheck : ListChecks;
  const face = (
    <>
      <Icon
        size={20}
        strokeWidth={2}
        aria-hidden
        className={busy && !open ? 'motion-safe:animate-spin' : undefined}
      />
      <span>{progress}</span>
      {open ? <ChevronDown size={16} aria-hidden className="-ml-1" /> : null}
      {dot ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-danger ring-2 ring-surface"
        />
      ) : null}
    </>
  );
  const name = [
    progress,
    dot ? t('regis.needsLook') : null,
    busy && !open ? t('regis.status.adding') : null,
  ]
    .filter((part) => part !== null)
    .join(', ');
  return { face, name, busy };
}

const LAUNCHER_FACE = `z-host ${LAUNCHER_BOX} bg-primary-strong text-white shadow-kcp hover:bg-primary-hover motion-safe:transition-[translate,background-color] motion-safe:duration-fast motion-safe:ease-out motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 ${FOCUS_OUTLINE}`;

const LAUNCHER_CLASS = `fixed right-[calc(max(20px,var(--kcp-safe-right))_+_var(--kcp-visible-right,0px))] bottom-[calc(max(20px,var(--kcp-safe-bottom))_+_var(--kcp-visible-bottom,0px))] ${LAUNCHER_FACE}`;

// On a helper page the launcher rises 64 px to clear the host's own back to top button, a
// 56 px round button 16 px above the bottom right corner, measured on app.a1e43722 on a
// 412 px phone, so it sits 12 px above it rather than over it (Section 6.1). It rises only
// on a screen tall enough to keep the card above it whole (--kcp-helper-lift in style.css).
// The card and the toast floor sit on the launcher, so they rise with it.
const COMPANION_LAUNCHER_CLASS = `fixed right-[calc(max(20px,var(--kcp-safe-right))_+_var(--kcp-visible-right,0px))] bottom-[calc(max(20px,var(--kcp-safe-bottom))_+_var(--kcp-helper-lift)_+_var(--kcp-visible-bottom,0px))] ${LAUNCHER_FACE}`;

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
  const companion = useCompanionRoute() !== null;
  return companion ? <CompanionLauncher /> : <PanelLauncher />;
}

function useCovered(): boolean {
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const welcomeOpen = useStore(onboardingStore, (state) => state.welcomeOpen);
  return isOpen || welcomeOpen;
}

function IssueBadge() {
  const issueCount = useStore(uiStore, (state) => state.diagnosticsIssueCount);
  return issueCount !== null && issueCount > 0 ? (
    <span
      aria-hidden
      className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white"
    >
      {issueCount}
    </span>
  ) : null;
}

function PanelLauncher() {
  const covered = useCovered();
  const welcomeOpen = useStore(onboardingStore, (state) => state.welcomeOpen);
  const openPanel = useStore(uiStore, (state) => state.open);
  const attention = useLauncherAttention(welcomeOpen);
  const { t, language } = useTranslation();
  return (
    <button
      id={LAUNCHER_ID}
      type="button"
      onClick={openPanel}
      inert={covered || undefined}
      aria-hidden={covered || undefined}
      aria-label={t('launcher.open')}
      lang={language}
      className={`${LAUNCHER_CLASS}${attention ? ' kcp-launcher-ring' : ''}`}
    >
      <LauncherFace />
      <IssueBadge />
    </button>
  );
}

// Expanding hands focus to the card's count, so the keyboard lands where the card starts.
// While Add for me runs, a press keeps the card open and hands focus to Stop instead of
// collapsing it, since a collapse would end the run: the launcher sits where a thumb rests
// on a phone, so a press of it is as likely to be a stray touch as a choice to stop. Stop
// and Escape inside the card stay the deliberate ways to stop (ADR-0078).
function CompanionLauncher() {
  const covered = useCovered();
  const collapsed = useStore(helperStore, (state) => state.collapsed);
  const hidden = useStore(helperStore, (state) => state.hidden);
  const ready = useStore(helperStore, (state) => state.ready);
  const open = !collapsed && ready && !covered;
  const { face, name, busy } = useCompanionFace(open);
  const { language } = useTranslation();
  if (hidden) return null;
  return (
    <button
      id={LAUNCHER_ID}
      type="button"
      onClick={(event) => {
        const root = rootOf(event.currentTarget);
        if (open && busy) {
          focusFirst([
            root?.getElementById(STOP_ID),
            root?.getElementById(COUNT_ID),
          ]);
          return;
        }
        if (open) {
          chooseCollapsed(true);
          return;
        }
        commitThenFocus(
          () => {
            markReady();
            chooseCollapsed(false);
          },
          () => [root?.getElementById(COUNT_ID)],
        );
      }}
      inert={covered || undefined}
      aria-hidden={covered || undefined}
      aria-expanded={open}
      aria-controls={CARD_ID}
      aria-label={name}
      lang={language}
      className={COMPANION_LAUNCHER_CLASS}
    >
      {face}
      <IssueBadge />
    </button>
  );
}
