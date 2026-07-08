// The single toast region, pinned to the panel bottom. It renders at most one
// toast, auto dismisses after a short delay, and announces politely so a screen
// reader hears the outcome. The live region stays mounted even when empty so an
// announcement fires the moment a toast appears. Motion is a short rise that the
// reduced motion media query removes, leaving the color and text.

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { toastStore } from './toastStore';

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

  useEffect(() => {
    if (toast === null) {
      return;
    }
    const { id } = toast;
    const timer = setTimeout(() => {
      dismiss(id);
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast, dismiss]);

  const Icon = toast ? ICON[toast.kind] : null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[2147483647] flex justify-center px-4"
    >
      {toast !== null && Icon !== null ? (
        <div
          role="status"
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
