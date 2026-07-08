// The one global feedback channel for actions whose outcome is not otherwise
// visible on screen: copy, export, cache clear, and a refresh that returned
// unchanged data. Search is excluded because its skeleton, results, error, and
// empty states already communicate. One toast shows at a time and a new one
// replaces the current, so the latest outcome is always the one on screen. The
// message is a resolved string, so production callers localize through t() before
// showing and the debug drawer passes its English copy directly.

import { createStore } from 'zustand/vanilla';

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastState {
  toast: Toast | null;
  show: (kind: ToastKind, message: string) => void;
  dismiss: (id?: number) => void;
}

export function createToastStore() {
  let nextId = 0;
  return createStore<ToastState>((set) => ({
    toast: null,
    show: (kind, message) => {
      nextId += 1;
      set({ toast: { id: nextId, kind, message } });
    },
    dismiss: (id) => {
      // Clear only when the id matches the current toast, so the auto dismiss
      // timer of a replaced toast never dismisses its successor.
      set((state) =>
        id === undefined || state.toast?.id === id ? { toast: null } : state,
      );
    },
  }));
}

/** The single store instance the content script UI binds to. */
export const toastStore = createToastStore();
