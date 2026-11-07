// The entry toast: a short prompt beside the launcher on a visit, naming what the planner
// offers from where the student is (ADR-0063). It is a prompt anchored to the launcher,
// not action feedback, so it is its own surface rather than a toast store entry, and it is
// no precedent for new toasts. Visually it follows the panel toast pattern: the same
// tokens, the same entrance, which reduced motion removes, the same close button, and
// the same hover and focus hold.
//
// Its polite live region is mounted empty from the start, so the announcement fires the
// moment the text arrives, and it carries the panel language, since it sits outside the
// overlay root. Showing it never moves focus. It mounts right after the launcher, so Tab
// from the launcher reaches it. Every action opens the panel through the one funnel.
// Leaving the toast while focus is inside it hands focus to the launcher first, so focus
// never falls back to the host page, and the panel records the launcher as its opener.
//
// The route offer's action runs the search the host result route shows. It hydrates the
// persisted search with the prefill on top, runs it once as the student's explicit
// action (Section 4.7), and opens the catalog on it. The submit writes the loading state
// before its first await, so the catalog's first frame already shows the search. A
// prefill the form cannot build sends nothing, and the catalog still opens.
//
// It sits 60 px above the launcher's bottom offset, which clears the 48 px launcher by
// 12 px, and its width is capped at the viewport less both side offsets, so it never
// crosses the left inset on a narrow screen.

import { useRef, type KeyboardEvent } from 'react';
import { Info, X } from 'lucide-react';
import type { SearchPrefill } from '@/lib/search/queryForms';
import type { OnboardingRepository } from '@/lib/storage/onboarding';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { openPanelAt } from '@/features/shell/openPanel';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { activeElementWithin, rootOf } from '@/features/shell/useFocusTrap';
import { useHoverFocusHold } from '@/features/shell/useHoverFocusHold';
import { useTranslation } from '@/features/shell/useTranslation';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { searchStore } from '@/features/search/searchStore';
import { useSearchActions } from '@/features/search/useSearchController';
import { recordOnboardingMoment } from './recordOnboardingMoment';
import { useEntryToastSchedule } from './useEntryToastSchedule';

// The toast shows at most once per document, so one constant key is enough for the hold.
const HOLD_KEY = 'entry-toast';

const TEXT_BUTTON = `shrink-0 rounded-kcp px-1 underline ${TARGET_HEIGHT} ${FOCUS_RING}`;
const ACTION_BUTTON = `${TEXT_BUTTON} font-semibold text-primary-strong`;

type ActionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => void;

interface RouteActionProps {
  prefill: SearchPrefill;
  label: string;
  onLeave: () => void;
  onKeyDown: ActionKeyDown;
}

// Its own component, since only the route offer needs the search dependencies.
function RouteAction({ prefill, label, onLeave, onKeyDown }: RouteActionProps) {
  const deps = useSearchDeps();
  const { submit } = useSearchActions(deps);

  const handleClick = (): void => {
    onLeave();
    void (async () => {
      await searchStore.getState().applyRoutePrefill(prefill, deps.repo);
      const search = submit();
      openPanelAt('catalog');
      await search;
    })();
  };

  return (
    <button
      type="button"
      onKeyDown={onKeyDown}
      onClick={handleClick}
      className={ACTION_BUTTON}
    >
      {label}
    </button>
  );
}

export interface EntryToastProps {
  /** Only the patch: the opt out records its moment through the repository. */
  record: Pick<OnboardingRepository, 'patch'>;
}

export function EntryToast({ record }: EntryToastProps) {
  const { t, language } = useTranslation();
  const { held, handlers } = useHoverFocusHold(HOLD_KEY);
  const { content, end } = useEntryToastSchedule(held);
  const boxRef = useRef<HTMLDivElement>(null);

  /** Hides the toast, handing focus to the launcher when it was inside the toast. */
  const leave = (): void => {
    const box = boxRef.current;
    const active = box === null ? null : activeElementWithin(box);
    if (box === null || active === null || !box.contains(active)) {
      end();
      return;
    }
    const root = rootOf(box);
    commitThenFocus(end, () => [root?.getElementById(LAUNCHER_ID)]);
  };

  const handleKeyDown: ActionKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    leave();
  };

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      lang={language}
      className="pointer-events-none fixed right-[max(20px,var(--kcp-safe-right))] bottom-[calc(max(20px,var(--kcp-safe-bottom))_+_60px)] z-host w-[min(20rem,calc(100vw_-_max(16px,var(--kcp-safe-left))_-_max(20px,var(--kcp-safe-right))))]"
    >
      {content === null ? null : (
        <div
          ref={boxRef}
          {...handlers}
          data-entry-toast={content.kind}
          className="kcp-toast-enter pointer-events-auto flex items-start gap-2 rounded-kcp border border-border bg-surface py-2 pr-2 pl-3 text-sm text-ink shadow-kcp"
        >
          <Info
            size={16}
            strokeWidth={2}
            aria-hidden
            className="mt-0.5 shrink-0 text-ink-soft"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="break-words">
              {fillTemplate(t(content.messageKey), content.params)}
            </p>
            <div className="flex flex-wrap items-center gap-x-3">
              {content.kind === 'route' ? (
                <RouteAction
                  prefill={content.prefill}
                  label={t(content.actionKey)}
                  onLeave={leave}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <button
                  type="button"
                  onKeyDown={handleKeyDown}
                  onClick={() => {
                    leave();
                    openPanelAt(content.target);
                  }}
                  className={ACTION_BUTTON}
                >
                  {t(content.actionKey)}
                </button>
              )}
              <button
                type="button"
                onKeyDown={handleKeyDown}
                onClick={() => {
                  recordOnboardingMoment(record, 'entryToastOptOutAt');
                  leave();
                }}
                className={`${TEXT_BUTTON} text-ink-soft hover:text-ink`}
              >
                {t('entryToast.optOut')}
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('entryToast.close')}
            onKeyDown={handleKeyDown}
            onClick={leave}
            className={`inline-flex shrink-0 items-center justify-center rounded-kcp p-0.5 text-ink-soft hover:bg-black/5 hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
