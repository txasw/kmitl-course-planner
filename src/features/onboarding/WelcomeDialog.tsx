// The one time welcome shown after install (ADR-0062). It thanks the student, says what
// the planner does and where saved plans stay, lists the three steps of a plan in
// order, and says how to open the panel again, naming the shortcut only when the browser
// reports one. Start planning is the landing point and the likely next step: it closes
// the welcome and opens the panel at the catalog. The close button, the scrim and Escape
// close it too, and nothing reopens it, since the claim recorded it as shown.
//
// It is a narrow centred dialog from 640 px and a bottom sheet below, like the updates
// dialog, so it reuses their focus trap, Escape layer and safe area padding. Closing
// hands focus to the launcher, the control that opens the panel from then on, so focus
// never falls back to the host page from the shadow root. The panel opens after that
// move, so its own trap records the launcher as its opener and returns focus there when
// it closes.

import { useId, useRef } from 'react';
import { useStore } from 'zustand';
import { CalendarPlus, Image, Search, type LucideIcon } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { ModalDialog } from '@/components/ModalDialog';
import type { TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { openPanelAt } from '@/features/shell/openPanel';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import { onboardingStore } from './onboardingStore';

interface WelcomeStep {
  icon: LucideIcon;
  title: TranslationKey;
  body: TranslationKey;
}

const STEPS: readonly WelcomeStep[] = [
  {
    icon: Search,
    title: 'welcome.step.search.title',
    body: 'welcome.step.search.body',
  },
  {
    icon: CalendarPlus,
    title: 'welcome.step.place.title',
    body: 'welcome.step.place.body',
  },
  {
    icon: Image,
    title: 'welcome.step.share.title',
    body: 'welcome.step.share.body',
  },
];

const PRIMARY_BUTTON = `rounded-kcp bg-primary-strong px-4 py-2 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`;

export function WelcomeDialog() {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const shortcut = useStore(onboardingStore, (state) => state.shortcut);
  const startRef = useRef<HTMLButtonElement>(null);
  const bodyId = useId();
  const stepsId = useId();

  const handleClose = (): void => {
    const node = startRef.current;
    const root = node === null ? null : rootOf(node);
    commitThenFocus(
      () => {
        onboardingStore.getState().setWelcomeOpen(false);
      },
      () => [root?.getElementById(LAUNCHER_ID)],
    );
  };

  const handleStart = (): void => {
    handleClose();
    openPanelAt('catalog');
  };

  const access =
    shortcut === null
      ? t('welcome.access')
      : fillTemplate(t('welcome.access.shortcut'), { shortcut });

  const body = (
    <div className="flex flex-col gap-4">
      <p id={bodyId}>{t('welcome.body')}</p>
      <section aria-labelledby={stepsId} className="flex flex-col gap-3">
        <h3 id={stepsId} className="text-sm font-semibold">
          {t('welcome.steps')}
        </h3>
        <ol className="flex flex-col gap-3">
          {STEPS.map(({ icon: Icon, title, body: stepBody }) => (
            <li key={title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
              >
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{t(title)}</span>
                <span className="text-ink-soft">{t(stepBody)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-ink-soft">{access}</p>
    </div>
  );

  const surface = {
    title: t('welcome.title'),
    closeLabel: t('welcome.close'),
    onClose: handleClose,
    footer: (
      <div className="flex justify-end">
        <button
          ref={startRef}
          type="button"
          onClick={handleStart}
          className={PRIMARY_BUTTON}
        >
          {t('welcome.start')}
        </button>
      </div>
    ),
    initialFocusRef: startRef,
    describedBy: bodyId,
  };

  return tier === 'compact' ? (
    <BottomSheet {...surface}>
      <div className="pt-2">{body}</div>
    </BottomSheet>
  ) : (
    <ModalDialog {...surface} width="narrow">
      {body}
    </ModalDialog>
  );
}
