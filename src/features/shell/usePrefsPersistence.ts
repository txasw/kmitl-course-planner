import { useEffect } from 'react';
import type { PrefsRepository } from '@/lib/storage/prefs';
import { uiStore } from './uiStore';

// Hydrates the stored UI preferences, the language and the view mode, on mount,
// then persists explicit changes to either. Both live under one storage key, so a
// single hook writes the whole preferences object on any change rather than two
// hooks clobbering each other's field. The subscription attaches only after
// hydration, so a hydrated value is not written straight back, and a change made
// during the async read is respected rather than overwritten by the stored value.
export function usePrefsPersistence(repo: PrefsRepository): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const initialLanguage = uiStore.getState().language;
    const initialViewMode = uiStore.getState().viewMode;

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
      }
      unsubscribe = uiStore.subscribe((state, previous) => {
        if (
          state.language !== previous.language ||
          state.viewMode !== previous.viewMode
        ) {
          void repo.save({
            schemaVersion: 1,
            language: state.language,
            viewMode: state.viewMode,
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
