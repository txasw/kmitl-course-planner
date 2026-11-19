import { useCallback, useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { CloudOff } from 'lucide-react';
import {
  autosaveStore,
  PLAN_SWITCHER_TRIGGER_ID,
} from '@/features/plans/autosaveStore';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { focusFirst } from './restoreFocus';
import { activeElementWithin, rootOf } from './useFocusTrap';
import { useTranslation } from './useTranslation';

// The header save indicator. Autosave runs on every change, so a save in progress or a
// save that landed shows nothing: a mark that flickers on each edit drew the eye on a
// phone header without telling the student anything they had to act on. Only a failed
// save shows, as a danger button that saves again, so the retry outlives the error toast,
// which leaves on its own. It shows the cloud off mark with its word from 640 px and the
// mark alone below, with the word in its accessible name and title. It is no live region:
// the failure is announced once by its toast. It renders nothing while autosave is off,
// such as before the plans load or for a refused newer schema.
//
// When the button leaves while it holds focus, after a retry turns the state to saving,
// focus moves to the plan switcher trigger beside it rather than falling to the body. The
// store listener runs before React renders the change, so it notes the root that held
// focus while the button is still mounted, and the move happens on commit.
export function SaveIndicator() {
  const status = useStore(autosaveStore, (state) => state.status);
  const retry = useStore(autosaveStore, (state) => state.retry);
  const { t } = useTranslation();
  const node = useRef<HTMLButtonElement | null>(null);
  const handoff = useRef<Document | ShadowRoot | null>(null);
  const setNode = useCallback((element: HTMLButtonElement | null) => {
    node.current = element;
  }, []);

  useLayoutEffect(
    () =>
      autosaveStore.subscribe((state, previous) => {
        const current = node.current;
        if (
          previous.status === 'failed' &&
          state.status !== 'failed' &&
          current !== null &&
          activeElementWithin(current) === current
        ) {
          handoff.current = rootOf(current);
        }
      }),
    [],
  );

  useLayoutEffect(() => {
    const root = handoff.current;
    if (root === null) return;
    handoff.current = null;
    focusFirst([root.getElementById(PLAN_SWITCHER_TRIGGER_ID)], {
      preventScroll: true,
    });
  }, [status]);

  if (status !== 'failed') return null;

  return (
    <button
      ref={setNode}
      type="button"
      onClick={() => {
        retry?.();
      }}
      aria-label={t('save.retryLabel')}
      title={t('save.retryLabel')}
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-kcp border border-danger bg-danger-soft px-2 text-xs font-semibold text-danger hover:bg-surface ${TARGET_SIZE} ${FOCUS_RING}`}
    >
      <CloudOff size={16} strokeWidth={2} aria-hidden className="shrink-0" />
      <span className="sr-only whitespace-nowrap sm:not-sr-only">
        {t('save.failed')}
      </span>
    </button>
  );
}
