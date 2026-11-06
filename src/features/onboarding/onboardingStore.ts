// Session scoped onboarding state for this document. It mirrors the worker owned
// install record and the content owned onboarding record once both are read, and
// tracks what this document has decided about the first run surfaces: whether the
// mount handshake and the welcome decision have settled, whether the welcome is
// open, and whether this document must stay quiet because it showed the welcome,
// applied a requested open, or found the welcome pending when it loaded. It carries
// no browser or React imports and no persistence; the persistence hook writes the
// record through the storage repository.

import { createStore } from 'zustand/vanilla';
import type { InstallRecord } from '@/lib/storage/install';
import {
  emptyOnboardingRecord,
  type OnboardingRecord,
} from '@/lib/storage/onboarding';

export interface OnboardingData {
  /** Whether both stored records have been read, even when a read failed. */
  loaded: boolean;
  /** The install record as read at load, or null when absent or unreadable. */
  install: InstallRecord | null;
  /** The latest known onboarding record. */
  record: OnboardingRecord;
  /** Whether the first read found an install with no welcome shown yet. */
  welcomePendingAtLoad: boolean;
  /** Whether the mount handshake with the worker has settled. */
  handshakeSettled: boolean;
  /** Whether this document has decided whether it shows the welcome. */
  welcomeSettled: boolean;
  welcomeOpen: boolean;
  /**
   * Whether this document opened the panel because the worker asked, from the mount
   * handshake or a later command. Such a document never claims the welcome, so the
   * welcome and the panel do not stack.
   */
  openRequested: boolean;
  /**
   * Whether this document holds back the entry prompts: it showed the welcome,
   * applied an open the worker requested, or found the welcome pending at load.
   */
  documentSuppressed: boolean;
  /** The open shortcut in words, or null when none is assigned. */
  shortcut: string | null;
}

export interface OnboardingState extends OnboardingData {
  /** Records the first read of both records; later calls change nothing. */
  hydrate: (install: InstallRecord | null, record: OnboardingRecord) => void;
  setRecord: (record: OnboardingRecord) => void;
  settleHandshake: () => void;
  settleWelcome: () => void;
  setWelcomeOpen: (open: boolean) => void;
  /** Records an open the worker requested, which also suppresses the document. */
  markOpenRequested: () => void;
  suppressDocument: () => void;
  setShortcut: (shortcut: string | null) => void;
}

/** The state a document starts with, before either record is read. */
export function initialOnboardingData(): OnboardingData {
  return {
    loaded: false,
    install: null,
    record: emptyOnboardingRecord(),
    welcomePendingAtLoad: false,
    handshakeSettled: false,
    welcomeSettled: false,
    welcomeOpen: false,
    openRequested: false,
    documentSuppressed: false,
    shortcut: null,
  };
}

/**
 * Builds a fresh store. The factory form keeps tests isolated, since each test
 * gets its own instance rather than sharing module state.
 */
export function createOnboardingStore() {
  return createStore<OnboardingState>((set) => ({
    ...initialOnboardingData(),
    hydrate: (install, record) => {
      set((state) => {
        if (state.loaded) return state;
        // Pending at load is judged once, from the first read, so a welcome that
        // another tab shows later does not lift this document's suppression.
        const welcomePendingAtLoad =
          install !== null && record.welcomeShownAt === undefined;
        return {
          loaded: true,
          install,
          record,
          welcomePendingAtLoad,
          documentSuppressed: state.documentSuppressed || welcomePendingAtLoad,
        };
      });
    },
    setRecord: (record) => {
      set({ record });
    },
    settleHandshake: () => {
      set({ handshakeSettled: true });
    },
    settleWelcome: () => {
      set({ welcomeSettled: true });
    },
    setWelcomeOpen: (welcomeOpen) => {
      set({ welcomeOpen });
    },
    markOpenRequested: () => {
      set({ openRequested: true, documentSuppressed: true });
    },
    suppressDocument: () => {
      set({ documentSuppressed: true });
    },
    setShortcut: (shortcut) => {
      set({ shortcut });
    },
  }));
}

/** The single store instance the content script UI binds to. */
export const onboardingStore = createOnboardingStore();
