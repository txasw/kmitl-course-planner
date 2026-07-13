// The single toast region, pinned to the panel bottom. It renders at most one thing at
// a time, auto dismisses an ordinary toast after a short delay, and announces politely
// so a screen reader hears the outcome. The live region stays mounted even when empty
// so an announcement fires the moment a toast appears. Motion is a short rise that the
// reduced motion media query removes, leaving the color and text.
//
// A pending undo takes priority over an ordinary toast: the undo toast holds the region
// for its window and ordinary toasts queue behind it rather than displacing it. The undo
// toast shows only while the panel is open, since it belongs to a plan mutation made in
// the panel; the pending undo itself lives in the plan store and survives a close.

import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { planStore } from '@/features/plans/planStore';
import { toastStore } from './toastStore';
import { uiStore } from './uiStore';
import { useTranslation } from './useTranslation';
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

export function Toaster() {
  const toast = useStore(toastStore, (state) => state.toast);
  const dismiss = useStore(toastStore, (state) => state.dismiss);
  const pendingUndo = useStore(planStore, (state) => state.pendingUndo);
  const isOpen = useStore(uiStore, (state) => state.isOpen);
  const { t, language } = useTranslation();

  // The undo toast owns the region while the panel is open; an ordinary toast waits.
  const showUndo = pendingUndo !== null && isOpen;

  useEffect(() => {
    // An ordinary toast auto dismisses only while it is the thing on screen. While an
    // undo toast holds the region, hold the ordinary toast so it queues behind it.
    if (toast === null || showUndo) {
      return;
    }
    const { id } = toast;
    const timer = setTimeout(() => {
      dismiss(id);
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast, dismiss, showUndo]);

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

  const Icon = toast ? ICON[toast.kind] : null;
  // A stable key per pending undo, so a new removal remounts the toast with a fresh
  // window rather than inheriting the previous one's remaining time. Different affected
  // sections yield different keys; the same section cannot be removed twice without an
  // intervening re-add, which unmounts the toast, so a fresh mount always resets it.
  const undoKey =
    pendingUndo === null
      ? ''
      : `${pendingUndo.kind}:${[...pendingUndo.removed, ...pendingUndo.added]
          .map((entry) => entry.teachTableId)
          .join(',')}`;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[2147483647] flex justify-center px-4"
    >
      {pendingUndo !== null && isOpen ? (
        <UndoToast key={undoKey} record={pendingUndo} locale={language} t={t} />
      ) : toast !== null && Icon !== null ? (
        // Not a live region itself; the outer element is the sole announcer, so
        // nesting a second live region here would double announce. The id key
        // replays the entrance when one toast replaces another.
        <div
          key={toast.id}
          className={`kcp-toast-enter flex max-w-md items-center gap-2 rounded-kcp border px-3 py-2 text-sm text-ink shadow-kcp ${VARIANT[toast.kind]}`}
        >
          <Icon
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`shrink-0 ${ICON_COLOR[toast.kind]}`}
          />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
