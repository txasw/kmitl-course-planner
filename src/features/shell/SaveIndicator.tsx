import { useCallback, useId, useLayoutEffect, useRef } from 'react';
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

// The save state, shown only when a save failed. Autosave runs on every change, so a
// save in progress or a save that landed shows nothing: a mark that changed on each edit
// drew the eye on a phone header without asking the student to do anything. A failed
// save shows as a danger strip under the header, with the sentence that says what is
// lost and a button that saves again, so the retry outlives the error toast, which
// leaves on its own. It sits under the header rather than in it, because beside the plan
// switcher on a phone it took the width the plan name needs and cut it short; in its own
// strip every word wraps and shows in full. It is no live region: the failure is
// announced once by its toast. It renders nothing while autosave is off, such as before
// the plans load or for a refused newer schema.
//
// When the strip leaves while its button holds focus, after a retry turns the state to
// saving, focus moves to the plan switcher trigger rather than falling to the body. The
// store listener runs before React renders the change, so it notes the root that held
// focus while the button is still mounted, and the move happens on commit.
export function SaveIndicator() {
  const status = useStore(autosaveStore, (state) => state.status);
  const retry = useStore(autosaveStore, (state) => state.retry);
  const { t } = useTranslation();
  const messageId = useId();
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
    <div className="mt-2 mr-[calc(12px_+_var(--kcp-safe-right))] ml-[calc(12px_+_var(--kcp-safe-left))] flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-kcp border border-danger bg-danger-soft px-3 py-2 text-xs sm:mr-[calc(16px_+_var(--kcp-safe-right))] sm:ml-[calc(16px_+_var(--kcp-safe-left))]">
      <CloudOff
        size={16}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-danger"
      />
      <p id={messageId} className="min-w-0 flex-1 basis-40 text-ink">
        {t('save.failed')}
      </p>
      <button
        ref={setNode}
        type="button"
        onClick={() => {
          retry?.();
        }}
        aria-describedby={messageId}
        className={`inline-flex shrink-0 items-center justify-center rounded-kcp border border-danger bg-surface px-3 font-semibold text-danger hover:bg-danger-soft ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        {t('save.retry')}
      </button>
    </div>
  );
}
