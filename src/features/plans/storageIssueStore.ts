// A small store for a plan storage problem found on load and surfaced to the user: a
// quarantined blob that was set aside, or a stored schema newer than this build knows.
// The quarantine card reads it. A failed save is not one: the autosave store and its
// toast report it. It is separate from the ui store so the plan persistence layer can
// set it without the shell depending on the plan feature.

import { createStore } from 'zustand/vanilla';

export type StorageIssue =
  { kind: 'quarantined'; data: string } | { kind: 'refused'; reason: string };

export interface StorageIssueStore {
  issue: StorageIssue | null;
  setIssue: (issue: StorageIssue | null) => void;
}

export function createStorageIssueStore() {
  return createStore<StorageIssueStore>((set) => ({
    issue: null,
    setIssue: (issue) => {
      set({ issue });
    },
  }));
}

/** The single store instance the quarantine card and the persistence hook share. */
export const storageIssueStore = createStorageIssueStore();
