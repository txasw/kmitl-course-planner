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
    viewMode: state.viewMode,
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
    timetableView: state.timetableView,
    catalogHides: selectHides(catalogStore.getState()),
  };
}

// Hydrates the stored UI preferences, the language, the view mode, the poster
// display options, the export template, the curriculum profile, the suggestion
// options, the narrow timetable view, and the catalog hide toggles, on mount, then
// persists explicit changes to any of them. They live under one storage key, so a
// single hook writes the whole preferences object on any change rather than several
// hooks clobbering each other's field. The subscriptions attach only after hydration,
// so a hydrated value is not written straight back, and a change made during the
// async read is respected rather than overwritten by the stored value.
export function usePrefsPersistence(repo: PrefsRepository): void {
  useEffect(() => {
    let cancelled = false;
    const unsubscribes: (() => void)[] = [];
    const initialLanguage = uiStore.getState().language;
    const initialViewMode = uiStore.getState().viewMode;
    const initialDisplayOptions = uiStore.getState().displayOptions;
    const initialTemplate = uiStore.getState().selectedTemplate;
    const initialProfile = uiStore.getState().curriculumProfile;
    const initialObjective = uiStore.getState().suggestObjective;
    const initialPreference = uiStore.getState().suggestPreference;
    const initialTimetableView = uiStore.getState().timetableView;
    const initialHides = selectHides(catalogStore.getState());

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
        if (
          stored.timetableView !== undefined &&
          state.timetableView === initialTimetableView
        ) {
          state.setTimetableView(stored.timetableView);
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
            state.viewMode !== previous.viewMode ||
            state.displayOptions !== previous.displayOptions ||
            state.selectedTemplate !== previous.selectedTemplate ||
            state.curriculumProfile !== previous.curriculumProfile ||
            state.suggestObjective !== previous.suggestObjective ||
            state.suggestPreference !== previous.suggestPreference ||
            state.timetableView !== previous.timetableView
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
