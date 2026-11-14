import { useCallback, useLayoutEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { Cloud, CloudCheck, CloudOff } from 'lucide-react';
import {
  autosaveStore,
  SAVE_INDICATOR_ID,
  type AutosaveStatus,
} from '@/features/plans/autosaveStore';
import { planStore } from '@/features/plans/planStore';
import type { TranslationKey } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { activeElementWithin } from './useFocusTrap';
import { useTranslation } from './useTranslation';

const QUIET = {
  saving: { icon: Cloud, label: 'save.saving' },
  saved: { icon: CloudCheck, label: 'save.saved' },
} as const satisfies Record<
  Exclude<AutosaveStatus, 'off' | 'failed'>,
  { icon: typeof Cloud; label: TranslationKey }
>;

const LABEL_CLASS = 'sr-only whitespace-nowrap sm:not-sr-only';

// The header save indicator: whether the latest plan change is stored in this browser.
// It shows a cloud mark with its word from 640 px and the mark alone below, with the
// word kept as sr-only text so a screen reader still names the state. It is not a live
// region: autosave runs on every change, so it stays quiet while saving and saved, and a
// failed save is announced once by its error toast. A failed state is a button that saves
// again, so the retry outlives the toast, which leaves on its own. It renders nothing
// while autosave is off, such as before the plans load or for a refused newer schema,
// and nothing beside an empty plan list unless its save failed, since there is no plan
// to call saved. The id is where a retry from the toast moves focus, so it can take
// focus in every state.
//
// A change between the failed button and the quiet span replaces the element, which
// would drop focus held on it, such as after pressing the button or after a retry from
// the toast that then fails. The store listener runs before React renders the change,
// so it notes whether the old element held focus, and the new one takes it on commit.
export function SaveIndicator() {
  const status = useStore(autosaveStore, (state) => state.status);
  const retry = useStore(autosaveStore, (state) => state.retry);
  const hasPlans = useStore(planStore, (state) => state.plans.length > 0);
  const { t } = useTranslation();
  const node = useRef<HTMLElement | null>(null);
  const keepFocus = useRef(false);
  const setNode = useCallback((element: HTMLElement | null) => {
    node.current = element;
  }, []);

  useLayoutEffect(
    () =>
      autosaveStore.subscribe((state, previous) => {
        const current = node.current;
        if (state.status !== previous.status && current !== null) {
          keepFocus.current = activeElementWithin(current) === current;
        }
      }),
    [],
  );

  useLayoutEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    node.current?.focus({ preventScroll: true });
  }, [status]);

  if (status === 'off' || (status !== 'failed' && !hasPlans)) {
    return null;
  }

  if (status === 'failed') {
    return (
      <button
        ref={setNode}
        id={SAVE_INDICATOR_ID}
        type="button"
        onClick={() => {
          retry?.();
        }}
        aria-label={t('save.retryLabel')}
        title={t('save.retryLabel')}
        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-kcp px-1 text-xs text-ink hover:bg-danger-soft ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        <CloudOff
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-danger"
        />
        <span className={LABEL_CLASS}>{t('save.failed')}</span>
      </button>
    );
  }

  const { icon: Icon, label } = QUIET[status];
  return (
    <span
      ref={setNode}
      id={SAVE_INDICATOR_ID}
      tabIndex={-1}
      title={status === 'saved' ? t('save.savedHint') : undefined}
      className={`inline-flex shrink-0 items-center gap-1 rounded-kcp px-1 text-xs text-ink-soft ${FOCUS_RING}`}
    >
      <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
      <span className={LABEL_CLASS}>{t(label)}</span>
    </span>
  );
}
