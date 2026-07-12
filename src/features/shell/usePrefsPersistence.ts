import { useEffect } from 'react';
import type { PrefsRepository } from '@/lib/storage/prefs';
import { uiStore } from './uiStore';

// Hydrates the stored UI preferences, the language, the view mode, and the poster
// display options, on mount, then persists explicit changes to any of them. They
// live under one storage key, so a single hook writes the whole preferences object
// on any change rather than several hooks clobbering each other's field. The
// subscription attaches only after hydration, so a hydrated value is not written
// straight back, and a change made during the async read is respected rather than
// overwritten by the stored value.
export function usePrefsPersistence(repo: PrefsRepository): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const initialLanguage = uiStore.getState().language;
    const initialViewMode = uiStore.getState().viewMode;
    const initialDisplayOptions = uiStore.getState().displayOptions;
    const initialTemplate = uiStore.getState().selectedTemplate;

    void repo.load().then((stored) => {
      if (cancelled) return;
      if (stored) {
        const state = uiStore.getState();
        if (state.language === initialLanguage) {
          state.setLanguage(stored.language);
        }
        if (
          stored.viewMode !== undefined &&
          state.viewMode === initialViewMode
        ) {
          state.setViewMode(stored.viewMode);
        }
        if (
          stored.displayOptions !== undefined &&
          state.displayOptions === initialDisplayOptions
        ) {
          state.setDisplayOptions(stored.displayOptions);
        }
        if (
          stored.exportTemplate !== undefined &&
          state.selectedTemplate === initialTemplate
        ) {
          state.setSelectedTemplate(stored.exportTemplate);
        }
      }
      unsubscribe = uiStore.subscribe((state, previous) => {
        if (
          state.language !== previous.language ||
          state.viewMode !== previous.viewMode ||
          state.displayOptions !== previous.displayOptions ||
          state.selectedTemplate !== previous.selectedTemplate
        ) {
          void repo.save({
            schemaVersion: 1,
            language: state.language,
            viewMode: state.viewMode,
            displayOptions: state.displayOptions,
            exportTemplate: state.selectedTemplate,
          });
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [repo]);
}
