// Session scoped panel state, held in memory. Because the content script mounts
// once and the host single page application never reloads, this state survives
// closing and reopening the overlay within a page session. It carries no browser
// or React imports, so it is testable through getState outside a renderer, and
// it holds no persistence: the language choice is written to storage by the
// panel that changes it, keeping the store free of storage concerns per ADR-0005.

import { createStore } from 'zustand/vanilla';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/t';

export interface UiState {
  isOpen: boolean;
  drawerOpen: boolean;
  language: Locale;
  /**
   * Count of error and warning issues in the latest data quality report, or null
   * when there is no report. The launcher shows a badge from it. It stays null in
   * production because only the debug diagnostics writes it; the launcher badge
   * therefore never appears in production.
   */
  diagnosticsIssueCount: number | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setDrawer: (open: boolean) => void;
  setLanguage: (language: Locale) => void;
  setDiagnosticsIssueCount: (count: number | null) => void;
}

/**
 * Builds a fresh store. The factory form keeps tests isolated, since each test
 * gets its own instance rather than sharing module state.
 */
export function createUiStore(language: Locale = DEFAULT_LOCALE) {
  return createStore<UiState>((set) => ({
    isOpen: false,
    drawerOpen: false,
    language,
    diagnosticsIssueCount: null,
    open: () => {
      set({ isOpen: true });
    },
    close: () => {
      // Closing the overlay also resets the drawer, which is only meaningful
      // while the overlay is open.
      set({ isOpen: false, drawerOpen: false });
    },
    toggle: () => {
      set((state) => ({ isOpen: !state.isOpen }));
    },
    setDrawer: (open) => {
      set({ drawerOpen: open });
    },
    setLanguage: (language) => {
      set({ language });
    },
    setDiagnosticsIssueCount: (count) => {
      set({ diagnosticsIssueCount: count });
    },
  }));
}

/** The single store instance the content script UI binds to. */
export const uiStore = createUiStore();
