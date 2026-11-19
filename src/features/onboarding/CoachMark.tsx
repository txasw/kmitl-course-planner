// The selector coach mark (ADR-0072): on the host search page it dims the whole page,
// leaves the launcher lit as a spotlight, and points at it from one large callout, so a
// student notices the planner at once. Maybe later hides it for this visit of the route,
// Not again today also keeps it away for the rest of the local day, and Escape or a press
// on the scrim act as Maybe later. The launcher stays live through the spotlight, and
// pressing it opens the panel, which ends the coach mark for the visit.
//
// It renders only inside the extension's own shadow root. The scrim is this layer's own
// fixed node above the host page; nothing on the host is touched, styled, or locked, so
// the host scroll is left alone. It is mounted before the launcher, so the launcher
// stacks above it by mount order and the overlay, mounted after both, covers it.
//
// It is a non modal dialog, labelled by the callout. The launcher, the action it points
// at, lives outside the dialog node, and the host page under the scrim cannot be made
// inert without touching it, so aria-modal true would hide the launcher from a screen
// reader and claim an isolation that does not exist. Focus starts on Maybe later and
// Tab cycles through the two buttons and the launcher, the only things the scrim leaves
// in reach. A polite region, mounted empty from the start, says where the planner is.
// When the coach mark hides while focus is inside it, focus moves to the launcher, so it
// never falls back to the host page.
//
// Layout. One grid anchored to the launcher's corner holds the callout, the buttons, the
// pointer, and a spacer with the launcher's own box and face, so the spacer covers the
// launcher exactly at every width and in both languages without measuring the launcher.
// The callout and the buttons sit in the column left of it, the buttons wrap onto their
// own lines on a narrow screen, and the pointer runs above the launcher from the end of
// the callout to the launcher's top, so no part covers another or the launcher.

import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { OnboardingRepository } from '@/lib/storage/onboarding';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { activeElementWithin, rootOf } from '@/features/shell/useFocusTrap';
import { useTranslation } from '@/features/shell/useTranslation';
import { CoachMarkPointer } from './CoachMarkPointer';
import { useCoachMark } from './useCoachMark';

const LATER_BUTTON = `pointer-events-auto inline-flex min-h-12 items-center rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink hover:bg-surface-alt ${FOCUS_RING}`;

// White on the scrim at rest. Focus turns it into a white chip with the inset ring, since
// the orange ring alone would sit on the dark scrim below the 3:1 bar.
const NOT_TODAY_BUTTON = `pointer-events-auto inline-flex items-center rounded-kcp px-2 text-sm text-white underline underline-offset-4 hover:bg-white/10 focus-visible:bg-surface focus-visible:text-ink ${TARGET_HEIGHT} ${FOCUS_RING}`;

export interface CoachMarkProps {
  /** Only the patch: Not again today records its day through the repository. */
  record: Pick<OnboardingRepository, 'patch'>;
}

export function CoachMark({ record }: CoachMarkProps) {
  const { t, language } = useTranslation();
  const { open, dismiss, snooze } = useCoachMark(record);
  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        lang={language}
        className="sr-only"
      >
        {open ? t('coachMark.announce') : null}
      </div>
      {open ? <OpenCoachMark onLater={dismiss} onNotToday={snooze} /> : null}
    </>
  );
}

interface OpenCoachMarkProps {
  onLater: () => void;
  onNotToday: () => void;
}

function OpenCoachMark({ onLater, onNotToday }: OpenCoachMarkProps) {
  const { t, language } = useTranslation();
  const titleId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  const laterHandler = useRef(onLater);

  useEffect(() => {
    laterHandler.current = onLater;
  }, [onLater]);

  useEffect(() => {
    laterRef.current?.focus({ preventScroll: true });
  }, []);

  // Hand focus to the launcher before the layer leaves, whatever ends it, so focus inside
  // the coach mark never drops to the host page.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    return () => {
      if (layer === null) return;
      const active = activeElementWithin(layer);
      if (active === null || !layer.contains(active)) return;
      const launcher = rootOf(layer)?.getElementById(LAUNCHER_ID);
      if (launcher instanceof HTMLElement)
        launcher.focus({ preventScroll: true });
    };
  }, []);

  // Escape and the Tab cycle are read on the shadow root, which sees a press on the
  // launcher too. An Escape pressed while focus sits on the host page is read on the
  // window and left to the host as it was; nothing is prevented there.
  useEffect(() => {
    const layer = layerRef.current;
    const root = layer === null ? null : rootOf(layer);
    if (layer === null || root === null) return undefined;

    const handleRootKeyDown = (event: Event): void => {
      if (!(event instanceof KeyboardEvent) || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        laterHandler.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const launcher = root.getElementById(LAUNCHER_ID);
      const first = firstRef.current;
      const active = root.activeElement;
      if (!event.shiftKey && active === launcher && first !== null) {
        event.preventDefault();
        first.focus();
      } else if (
        event.shiftKey &&
        active === first &&
        launcher instanceof HTMLElement
      ) {
        event.preventDefault();
        launcher.focus();
      }
    };
    const handleHostKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        laterHandler.current();
      }
    };

    root.addEventListener('keydown', handleRootKeyDown);
    window.addEventListener('keydown', handleHostKeyDown);
    return () => {
      root.removeEventListener('keydown', handleRootKeyDown);
      window.removeEventListener('keydown', handleHostKeyDown);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      lang={language}
      data-coach-mark=""
      className="fixed inset-0 z-host"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        data-coach-mark-scrim=""
        onClick={onLater}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        className="pointer-events-none fixed right-[max(20px,var(--kcp-safe-right))] bottom-[max(20px,var(--kcp-safe-bottom))] left-[max(16px,var(--kcp-safe-left))] grid grid-cols-[minmax(0,1fr)_16px_auto] grid-rows-[auto_auto] gap-y-3 sm:grid-cols-[minmax(0,1fr)_48px_auto] sm:gap-y-12"
      >
        <p
          id={titleId}
          className="kcp-coach-enter col-start-1 row-start-1 justify-self-end text-right text-xl font-semibold text-white sm:text-2xl"
        >
          <span className="relative inline-block pb-3 break-words">
            {t('coachMark.callout')}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              className="kcp-coach-reveal absolute bottom-0 left-0 h-3 w-full overflow-visible"
            >
              <path
                d="M2 9 C 24 3, 62 2, 98 6"
                fill="none"
                stroke="var(--kcp-primary)"
                strokeWidth={4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
        </p>
        <div className="kcp-coach-enter col-start-1 row-start-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 self-end">
          <button
            ref={firstRef}
            type="button"
            onClick={onNotToday}
            className={NOT_TODAY_BUTTON}
          >
            {t('coachMark.notToday')}
          </button>
          <button
            ref={laterRef}
            type="button"
            onClick={onLater}
            className={LATER_BUTTON}
          >
            {t('coachMark.later')}
          </button>
        </div>
        <CoachMarkPointer />
      </div>
    </div>
  );
}
