// Session scoped panel state, held in memory. Because the content script mounts
// once and the host single page application never reloads, this state survives
// closing and reopening the overlay within a page session. It carries no browser
// or React imports, so it is testable through getState outside a renderer, and
// it holds no persistence: the language choice is written to storage by the
// panel that changes it, keeping the store free of storage concerns per ADR-0005.

import { createStore } from 'zustand/vanilla';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/t';
import {
  DEFAULT_DISPLAY_OPTIONS,
  type DisplayOptions,
} from '@/lib/planner/displayOptions';
import { DEFAULT_TEMPLATE } from '@/lib/planner/exportTemplates';

/** The timetable presentation mode: full editing, or the inert preview poster. */
export type ViewMode = 'edit' | 'preview';

/** The plan view shown in edit mode: the weekly grid, or the list of placed subjects. */
export type PlanView = 'timetable' | 'selected';

/**
 * The pane the compact tier shows below 640 px (ADR-0048): the catalog with its search,
 * or the plan views, where the plan view picks the timetable or the selected list.
 */
export type MobilePane = 'catalog' | 'plan';

/**
 * The pane the compact tier opens on before the student picks one: the plan views when
 * the plan already holds entries, so a returning student sees the timetable, and the
 * catalog otherwise, since an empty plan has nothing to show yet (ADR-0049).
 */
export function defaultMobilePane(hasEntries: boolean): MobilePane {
  return hasEntries ? 'plan' : 'catalog';
}

export interface UiState {
  isOpen: boolean;
  /** Whether the catalog sheet is open, on the tiers where the catalog column is a sheet. */
  sheetOpen: boolean;
  /**
   * Whether the docked catalog column is shown, on the tiers where it docks beside the
   * grid. It is session only: it starts shown on every page load, and closing the overlay
   * keeps it, so a reopened panel resumes the layout the user left.
   */
  catalogVisible: boolean;
  language: Locale;
  viewMode: ViewMode;
  /**
   * The plan view tab in edit mode (ADR-0049). It is session only: it starts on the
   * timetable on every page load and survives closing and reopening the overlay.
   */
  planView: PlanView;
  /**
   * The pane the compact tier shows, or null until the compact tier first lays out. It
   * is settled once from the plan at that moment and then changes only on request, so an
   * add never switches panes. It is session only and survives closing the overlay.
   */
  mobilePane: MobilePane | null;
  /** Poster display options, applied to the preview and every export. */
  displayOptions: DisplayOptions;
  /** The chosen export template slug, applied to the preview and every image export. */
  selectedTemplate: string;
  /**
   * Count of error and warning issues in the latest data quality report, or null
   * when there is no report. The launcher shows a badge from it. It stays null in
   * production because only the debug diagnostics writes it; the launcher badge
   * therefore never appears in production.
   */
  diagnosticsIssueCount: number | null;
  /**
   * Forces the panel error boundary for manual QA. It stays false in production
   * because only the debug diagnostics drawer sets it and the probe that reads it is
   * gated behind the debug flag, so production carries only this inert boolean.
   */
  crashPanel: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSheetOpen: (open: boolean) => void;
  setCatalogVisible: (visible: boolean) => void;
  setLanguage: (language: Locale) => void;
  setViewMode: (mode: ViewMode) => void;
  setPlanView: (view: PlanView) => void;
  setMobilePane: (pane: MobilePane) => void;
  /** Settle the compact pane to its default when no pane is set yet; a set pane stays. */
  settleMobilePane: (hasEntries: boolean) => void;
  setDisplayOptions: (options: DisplayOptions) => void;
  setDisplayOption: (key: keyof DisplayOptions, value: boolean) => void;
  setSelectedTemplate: (slug: string) => void;
  setDiagnosticsIssueCount: (count: number | null) => void;
  setCrashPanel: (crash: boolean) => void;
}

/**
 * Builds a fresh store. The factory form keeps tests isolated, since each test
 * gets its own instance rather than sharing module state.
 */
export function createUiStore(language: Locale = DEFAULT_LOCALE) {
  return createStore<UiState>((set) => ({
    isOpen: false,
    sheetOpen: false,
    catalogVisible: true,
    language,
    viewMode: 'edit',
    planView: 'timetable',
    mobilePane: null,
    displayOptions: DEFAULT_DISPLAY_OPTIONS,
    selectedTemplate: DEFAULT_TEMPLATE.slug,
    diagnosticsIssueCount: null,
    crashPanel: false,
    open: () => {
      set({ isOpen: true });
    },
    close: () => {
      // Closing the overlay also resets the catalog sheet, which is only meaningful
      // while the overlay is open.
      set({ isOpen: false, sheetOpen: false });
    },
    toggle: () => {
      set((state) => ({ isOpen: !state.isOpen }));
    },
    setSheetOpen: (open) => {
      // Opening the sheet asks for the catalog, so a window widened past the dock finds
      // the column shown rather than hidden behind the rail. Closing it states nothing
      // about the docked column, which keeps its own choice.
      set(
        open ? { sheetOpen: true, catalogVisible: true } : { sheetOpen: false },
      );
    },
    setCatalogVisible: (catalogVisible) => {
      set({ catalogVisible });
    },
    setLanguage: (language) => {
      set({ language });
    },
    setViewMode: (viewMode) => {
      set({ viewMode });
    },
    setPlanView: (planView) => {
      set({ planView });
    },
    setMobilePane: (mobilePane) => {
      set({ mobilePane });
    },
    settleMobilePane: (hasEntries) => {
      set((state) =>
        state.mobilePane === null
          ? { mobilePane: defaultMobilePane(hasEntries) }
          : state,
      );
    },
    setDisplayOptions: (displayOptions) => {
      set({ displayOptions });
    },
    setDisplayOption: (key, value) => {
      set((state) => ({
        displayOptions: { ...state.displayOptions, [key]: value },
      }));
    },
    setSelectedTemplate: (selectedTemplate) => {
      set({ selectedTemplate });
    },
    setDiagnosticsIssueCount: (count) => {
      set({ diagnosticsIssueCount: count });
    },
    setCrashPanel: (crash) => {
      set({ crashPanel: crash });
    },
  }));
}

/** The single store instance the content script UI binds to. */
export const uiStore = createUiStore();
