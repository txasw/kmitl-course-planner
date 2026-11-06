// The single toast region, pinned to the panel bottom. It renders at most one thing at
// a time, auto dismisses an ordinary toast after a short delay, and announces politely
// so a screen reader hears the outcome. The live region stays mounted even when empty
// so an announcement fires the moment a toast appears. Motion is a short rise that the
// reduced motion media query removes, leaving the color and text. A toast that carries
// an action shows it before the close button; pressing it runs the action and dismisses
// the toast.
//
// A pending undo takes priority over an ordinary toast: the undo toast holds the region
// for its window and ordinary toasts queue behind it rather than displacing it. The undo
// toast shows only while the panel is open, since it belongs to a plan mutation made in
// the panel; the pending undo itself lives in the plan store and survives a close.
//
// The region sits outside the overlay root, so it carries the panel language itself and
// a screen reader announces a toast in the voice of the language it is written in.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { planStore } from '@/features/plans/planStore';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { toastStore, type Toast } from './toastStore';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';
import { usePrefersReducedMotion } from './usePresence';
import { useSwipeGesture } from './useSwipeGesture';
import { UndoToast } from './UndoToast';

const AUTO_DISMISS_MS = 4000;

const VARIANT = {
  success: 'border-success bg-success-soft',
  error: 'border-danger bg-danger-soft',
} as const;

const ICON = {
  success: CircleCheck,
  error: TriangleAlert,
} as const;

const ICON_COLOR = {
  success: 'text-success',
  error: 'text-danger',
} as const;

// One ordinary toast, with its action when it carries one, a close button and swipe to
// dismiss. Reduced motion turns the swipe off, leaving the close button and Escape as
// the dismissal. A toast with an action holds its timer while the pointer is over it or
// focus is within it, per WCAG timing, so the action does not leave under the pointer.
function OrdinaryToast({
  toast,
  onDismiss,
  onHold,
  t,
}: {
  toast: Toast;
  onDismiss: () => void;
  onHold: (held: boolean) => void;
  t: Translate;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const swipe = useSwipeGesture({
    axis: 'x',
    onSwipe: onDismiss,
    enabled: !reducedMotion,
  });
  const Icon = ICON[toast.kind];
  const { action } = toast;
  const hold = () => {
    onHold(true);
  };
  const release = () => {
    onHold(false);
  };
  const holdHandlers =
    action === undefined
      ? {}
      : {
          onMouseEnter: hold,
          onMouseLeave: release,
          onFocusCapture: hold,
          onBlurCapture: release,
        };
  const stopSwipe = (event: { stopPropagation: () => void }) => {
    // Keep a press on a control from arming the swipe on the toast behind it.
    event.stopPropagation();
  };
  const onEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onDismiss();
    }
  };
  return (
    <div
      {...holdHandlers}
      {...swipe.handlers}
      style={swipe.style}
      className={`kcp-toast-enter pointer-events-auto flex max-w-md items-center gap-2 rounded-kcp border py-2 pr-2 pl-3 text-sm text-ink shadow-kcp ${swipe.touchClass} ${VARIANT[toast.kind]}`}
    >
      <Icon
        size={16}
        strokeWidth={2}
        aria-hidden
        className={`shrink-0 ${ICON_COLOR[toast.kind]}`}
      />
      <span className="flex-1">{toast.message}</span>
      {action === undefined ? null : (
        <button
          type="button"
          onPointerDown={stopSwipe}
          onKeyDown={onEscape}
          onClick={(event) => {
            action.run(event.currentTarget);
            onDismiss();
          }}
          className={`shrink-0 rounded-kcp px-1 text-primary-strong underline pointer-coarse:min-h-11 ${FOCUS_RING}`}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t('action.dismiss')}
        onPointerDown={stopSwipe}
        onKeyDown={onEscape}
        onClick={onDismiss}
        className={`shrink-0 rounded-kcp p-0.5 text-ink-soft hover:bg-black/5 hover:text-ink ${FOCUS_RING}`}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toast = useStore(toastStore, (state) => state.toast);
  const dismiss = useStore(toastStore, (state) => state.dismiss);
  const pendingUndo = useStore(planStore, (state) => state.pendingUndo);
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const { t, language } = useTranslation();

  // The undo toast owns the region while the panel is open; an ordinary toast waits.
  const showUndo = pendingUndo !== null && isOpen;
  // The id of the toast the pointer or focus is holding. Keyed by id, a hold never
  // outlives its toast, even when the toast is replaced under a resting pointer.
  const [heldId, setHeldId] = useState<number | null>(null);
  const held = toast !== null && heldId === toast.id;

  useEffect(() => {
    // An ordinary toast auto dismisses only while it is the thing on screen. While an
    // undo toast holds the region, hold the ordinary toast so it queues behind it.
    if (toast === null || showUndo || held) {
      return;
    }
    const { id } = toast;
    const timer = setTimeout(() => {
      dismiss(id);
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast, dismiss, showUndo, held]);

  // Clear a panel toast when the overlay closes, so it does not linger over the
  // bare host page. A debug toast shown while the panel is already closed sees no
  // transition and stays for its normal life.
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      dismiss();
    }
    wasOpen.current = isOpen;
  }, [isOpen, dismiss]);

  // A stable key per pending undo, so a new removal remounts the toast with a fresh
  // window rather than inheriting the previous one's remaining time. Different affected
  // sections, or a different created plan, yield different keys; the same section cannot
  // be removed twice without an intervening re-add, which unmounts the toast, so a fresh
  // mount always resets it.
  const undoKey =
    pendingUndo === null
      ? ''
      : pendingUndo.kind === 'create'
        ? `create:${pendingUndo.planId}`
        : `${pendingUndo.kind}:${[...pendingUndo.removed, ...pendingUndo.added]
            .map((entry) => entry.teachTableId)
            .join(',')}`;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      lang={language}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-host flex justify-center px-4"
    >
      {pendingUndo !== null && isOpen ? (
        <UndoToast key={undoKey} record={pendingUndo} locale={language} t={t} />
      ) : toast !== null ? (
        // The outer element is the sole live region; the id key replays the entrance
        // when one toast replaces another.
        <OrdinaryToast
          key={toast.id}
          toast={toast}
          onDismiss={() => {
            dismiss(toast.id);
          }}
          onHold={(hold) => {
            setHeldId(hold ? toast.id : null);
          }}
          t={t}
        />
      ) : null}
    </div>
  );
}
