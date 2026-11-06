import { useEffect } from 'react';
import type { PrefsRepository } from '@/lib/storage/prefs';
import { uiStore } from './uiStore';

// Hydrates the stored UI preferences, the language, the view mode, the poster
// display options, the export template, the curriculum profile, and the suggestion
// options, on mount, then persists explicit changes to any of them. They live under
// one storage key, so a single hook writes the whole preferences object on any change
// rather than several hooks clobbering each other's field. The subscription attaches
// only after hydration, so a hydrated value is not written straight back, and a
// change made during the async read is respected rather than overwritten by the
// stored value.
export function usePrefsPersistence(repo: PrefsRepository): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const initialLanguage = uiStore.getState().language;
    const initialViewMode = uiStore.getState().viewMode;
    const initialDisplayOptions = uiStore.getState().displayOptions;
    const initialTemplate = uiStore.getState().selectedTemplate;
    const initialProfile = uiStore.getState().curriculumProfile;
    const initialObjective = uiStore.getState().suggestObjective;
    const initialPreference = uiStore.getState().suggestPreference;

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
        if (
          stored.curriculumProfile !== undefined &&
          state.curriculumProfile === initialProfile
        ) {
          state.setCurriculumProfile(stored.curriculumProfile);
        }
        if (
          stored.suggestObjective !== undefined &&
          state.suggestObjective === initialObjective
        ) {
          state.setSuggestObjective(stored.suggestObjective);
        }
        if (
          stored.suggestPreference !== undefined &&
          state.suggestPreference === initialPreference
        ) {
          state.setSuggestPreference(stored.suggestPreference);
        }
      }
      unsubscribe = uiStore.subscribe((state, previous) => {
        if (
          state.language !== previous.language ||
          state.viewMode !== previous.viewMode ||
          state.displayOptions !== previous.displayOptions ||
          state.selectedTemplate !== previous.selectedTemplate ||
          state.curriculumProfile !== previous.curriculumProfile ||
          state.suggestObjective !== previous.suggestObjective ||
          state.suggestPreference !== previous.suggestPreference
        ) {
          void repo.save({
            schemaVersion: 1,
            language: state.language,
            viewMode: state.viewMode,
            displayOptions: state.displayOptions,
            exportTemplate: state.selectedTemplate,
            ...(state.curriculumProfile === null
              ? {}
              : { curriculumProfile: state.curriculumProfile }),
            suggestObjective: state.suggestObjective,
            suggestPreference: state.suggestPreference,
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
