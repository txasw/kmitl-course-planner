import { useEffect } from 'react';
import type { PrefsRepository } from '@/lib/storage/prefs';
import { uiStore } from './uiStore';

// Hydrates the stored language on mount, then persists explicit language changes.
// The subscription attaches only after hydration, so the hydrated value is not
// written straight back, and a change made during the async read is respected
// rather than overwritten by the stored value.
export function useLanguagePersistence(repo: PrefsRepository): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const initial = uiStore.getState().language;

    void repo.load().then((stored) => {
      if (cancelled) return;
      if (stored && uiStore.getState().language === initial) {
        uiStore.getState().setLanguage(stored.language);
      }
      unsubscribe = uiStore.subscribe((state, previous) => {
        if (state.language !== previous.language) {
          void repo.save({ schemaVersion: 1, language: state.language });
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [repo]);
}
