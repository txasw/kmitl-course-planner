// The channel a feature uses to have the status announcer speak a line it composed, for an
// outcome only that feature can count, such as the catalog filter result. The announcer
// stays the one status region of ADR-0048, so a caller hands it a resolved string rather
// than mounting a live region of its own. Each line carries a fresh id, so a line that
// repeats the last is still read.

import { createStore } from 'zustand/vanilla';

export interface StatusLine {
  id: number;
  text: string;
}

interface StatusStore {
  line: StatusLine | null;
  say: (text: string) => void;
}

export const statusStore = createStore<StatusStore>((set) => ({
  line: null,
  say: (text) => {
    set((state) => ({ line: { id: (state.line?.id ?? 0) + 1, text } }));
  },
}));
