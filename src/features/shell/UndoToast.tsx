// The undo toast, shown in the bottom feedback region after a removal, move, or swap.
// It sits where the eye already is, on the block that just changed, rather than at the
// top of the panel where the old undo strip went unnoticed. It names what changed,
// offers undo after the text, and drains a thin progress bar over the plan store's ten
// second undo window. Hovering or focusing the toast pauses the drain and the timer per
// WCAG timing (SC 2.2.1), resuming on leave; expiry commits the change by clearing the
// pending undo. The pull back arrow is the same icon language as the catalog remove
// control (C2), and reduced motion drops the draining bar for a static message and
// button. It takes priority over ordinary toasts, which queue behind it, handled by the
// Toaster.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Undo2, X } from 'lucide-react';
import { planStore, type UndoRecord } from '@/features/plans/planStore';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { usePrefersReducedMotion } from './usePresence';
import { useSwipeDismiss } from './useSwipeDismiss';

/** Matches the plan store's undo window; the drain bar and the timer both run for it. */
export const UNDO_WINDOW_MS = 10_000;

const MUTATION_LABEL: Record<UndoRecord['kind'], TranslationKey> = {
  remove: 'feedback.removed',
  move: 'feedback.moved',
  swap: 'feedback.swapped',
};

interface UndoToastProps {
  record: UndoRecord;
  locale: Locale;
  t: Translate;
}

export function UndoToast({ record, locale, t }: UndoToastProps) {
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  // Dismissing an undo toast commits the removal immediately, the same as its expiry.
  const dismiss = () => {
    planStore.getState().clearUndo();
  };
  const swipe = useSwipeDismiss(dismiss, !reducedMotion);
  // The time left in the window, preserved across pauses so resume continues from it
  // rather than restarting the full ten seconds.
  const remainingRef = useRef(UNDO_WINDOW_MS);

  // One pausable timer drives the real expiry, which commits the change. The effect
  // registers its cleanup only while running (the paused branch returns undefined), so
  // the remaining time is decremented exactly once per run and a resume picks it up.
  useEffect(() => {
    if (paused) {
      return undefined;
    }
    const start = Date.now();
    const timer = setTimeout(() => {
      planStore.getState().clearUndo();
    }, remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - start),
      );
    };
  }, [paused]);

  // A removal names what left; a move or swap names what is now placed.
  const subject =
    record.kind === 'remove' ? record.removed[0] : record.added[0];
  if (subject === undefined) {
    return null;
  }
  const name =
    locale === 'th'
      ? subject.snapshot.subjectMeta.nameTh
      : subject.snapshot.subjectMeta.nameEn;
  // A coalesced removal names a count rather than one subject, since it folded several.
  const message =
    record.kind === 'remove' && record.removed.length > 1
      ? `${t('feedback.removed')} ${String(record.removed.length)} ${t('unit.sections')}`
      : `${t(MUTATION_LABEL[record.kind])} ${subject.subjectId} ${name}`;

  const pause = () => {
    setPaused(true);
  };
  const resume = () => {
    setPaused(false);
  };

  const stopSwipe = (event: { stopPropagation: () => void }) => {
    // Keep a press on a control from arming the swipe on the toast behind it.
    event.stopPropagation();
  };
  // Escape while a control in the toast is focused dismisses it, which commits the removal.
  // It sits on the buttons, the only focusable elements, so the toast container stays a
  // plain region without event listeners a static element may not carry.
  const onEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    }
  };

  return (
    <div
      // Pause the window while the pointer is over the toast or focus is within it, per
      // WCAG timing; onFocusCapture and onBlurCapture cover the controls inside.
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      {...swipe.handlers}
      style={swipe.style}
      className="kcp-toast-enter pointer-events-auto relative flex max-w-md items-center gap-2 overflow-hidden rounded-kcp border border-border bg-surface py-2 pr-2 pl-3 text-sm text-ink shadow-kcp"
    >
      <Undo2
        size={16}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-ink-soft"
      />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onPointerDown={stopSwipe}
        onKeyDown={onEscape}
        onClick={() => {
          planStore.getState().undo();
        }}
        className={`shrink-0 rounded-kcp px-1 font-medium text-primary-strong underline ${FOCUS_RING}`}
      >
        {t('action.undo')}
      </button>
      <button
        type="button"
        aria-label={t('action.dismiss')}
        onPointerDown={stopSwipe}
        onKeyDown={onEscape}
        onClick={dismiss}
        className={`shrink-0 rounded-kcp p-0.5 text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`}
      >
        <X size={14} aria-hidden />
      </button>
      <span
        aria-hidden
        data-paused={paused ? 'true' : undefined}
        style={{ animationDuration: `${String(UNDO_WINDOW_MS)}ms` }}
        className="kcp-undo-drain pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
      />
    </div>
  );
}
