import { useEffect } from 'react';
import type { Prefs, PrefsRepository } from '@/lib/storage/prefs';
import {
  catalogStore,
  sameHides,
  selectHides,
} from '@/features/catalog/catalogStore';
import { uiStore } from './uiStore';

/** The whole preferences object as the two stores hold it now. */
function currentPrefs(): Prefs {
  const state = uiStore.getState();
  return {
    schemaVersion: 1,
    language: state.language,
    displayOptions: state.displayOptions,
    // A template the student never chose stays unsaved, so the preview keeps
    // resolving it from the stage shape on the next open.
    ...(state.selectedTemplate === null
      ? {}
      : { exportTemplate: state.selectedTemplate }),
    ...(state.curriculumProfile === null
      ? {}
      : { curriculumProfile: state.curriculumProfile }),
    suggestObjective: state.suggestObjective,
    suggestPreference: state.suggestPreference,
    catalogHides: selectHides(catalogStore.getState()),
  };
}

// Hydrates the stored UI preferences, the language, the poster
// display options, the export template, the curriculum profile, the suggestion
// options, and the catalog hide toggles, on mount, then
// persists explicit changes to any of them. They live under one storage key, so a
// single hook writes the whole preferences object on any change rather than several
// hooks clobbering each other's field. The subscriptions attach only after hydration,
// so a hydrated value is not written straight back, and a change made during the
// async read is respected rather than overwritten by the stored value. The panel mode and
// the narrow timetable's day or week layout are not preferences: every opening starts in
// edit on the day view (ADR-0022 amendment, ADR-0049 amendment of 2026-11-21).
export function usePrefsPersistence(repo: PrefsRepository): void {
  useEffect(() => {
    let cancelled = false;
    const unsubscribes: (() => void)[] = [];
    const initialLanguage = uiStore.getState().language;
    const initialDisplayOptions = uiStore.getState().displayOptions;
    const initialTemplate = uiStore.getState().selectedTemplate;
    const initialProfile = uiStore.getState().curriculumProfile;
    const initialObjective = uiStore.getState().suggestObjective;
    const initialPreference = uiStore.getState().suggestPreference;
    const initialHides = selectHides(catalogStore.getState());

    void repo.load().then((stored) => {
      if (cancelled) return;
      if (stored) {
        const state = uiStore.getState();
        if (state.language === initialLanguage) {
          state.setLanguage(stored.language);
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
        const catalog = catalogStore.getState();
        if (
          stored.catalogHides !== undefined &&
          sameHides(selectHides(catalog), initialHides)
        ) {
          catalog.setHides(stored.catalogHides);
        }
      }
      const save = () => {
        void repo.save(currentPrefs());
      };
      unsubscribes.push(
        uiStore.subscribe((state, previous) => {
          if (
            state.language !== previous.language ||
            state.displayOptions !== previous.displayOptions ||
            state.selectedTemplate !== previous.selectedTemplate ||
            state.curriculumProfile !== previous.curriculumProfile ||
            state.suggestObjective !== previous.suggestObjective ||
            state.suggestPreference !== previous.suggestPreference
          ) {
            save();
          }
        }),
        catalogStore.subscribe((state, previous) => {
          if (!sameHides(selectHides(state), selectHides(previous))) {
            save();
          }
        }),
      );
    });

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [repo]);
}
