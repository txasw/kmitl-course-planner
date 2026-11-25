// What the read only observer last saw on the pre registration page (ADR-0077), in
// memory only: its health, the latest healthy observation, and the prerequisite ids the
// grade not announced dialog named for each planned subject. The conditional ids outlive
// the dialog and the subject reaching the list until the page reloads, since only the
// dialog says so. Nothing here is stored, logged, or sent.

import { createStore } from 'zustand/vanilla';
import type { ObservedPage } from '@/lib/regis/observedRow';
import type { Term } from '@/lib/routing/academicTerms';
import {
  INITIAL_HEALTH,
  nextHealth,
  recheckHealth,
  type Gate,
  type ObserverHealth,
} from '@/lib/regis/observerHealth';
import type { PageReading } from './hostDom';

export interface HostState {
  health: ObserverHealth;
  page: ObservedPage | null;
  /**
   * The term the page header last showed in this document. The host fixes the term when
   * the page mounts, so it outlives a later reading that drifts or degrades, and the helper
   * keeps following it; leaving the page forgets it.
   */
  term: Term | null;
  conditional: Readonly<Record<string, readonly string[]>>;
  /** How many times the student asked for the page to be read again. */
  checks: number;
  record: (gate: Gate, reading: PageReading) => void;
  /** Read the page again now, as the helper's Check again asks; a drift off reads anew. */
  recheck: () => void;
  /**
   * Start the reading over, as a new planned set or a Check again does: the page is
   * dropped and a health short of off starts again, while the term the header showed stays.
   */
  restart: () => void;
  /** Forget the page and its term when the student leaves it; an off state lasts the document. */
  leave: () => void;
}

export const hostStore = createStore<HostState>()((set, get) => ({
  health: INITIAL_HEALTH,
  page: null,
  term: null,
  conditional: {},
  checks: 0,
  recheck: () => {
    set({ checks: get().checks + 1, health: recheckHealth(get().health) });
  },
  record: (gate, reading) => {
    const health = nextHealth(get().health, gate, reading.reading);
    // A surrogate session is not the student's own registration, so its term is dropped.
    const term = gate.surrogate
      ? null
      : reading.reading === 'ok'
        ? (reading.observation.term ?? get().term)
        : get().term;
    if (health.status !== 'healthy' || reading.reading !== 'ok') {
      set({ health, term, page: null });
      return;
    }
    const { observation } = reading;
    const subjectId = observation.card?.subjectId ?? null;
    const conditional =
      observation.dialog?.kind === 'gradeNotAnnounced' && subjectId !== null
        ? {
            ...get().conditional,
            [subjectId]: observation.dialog.prerequisites,
          }
        : get().conditional;
    set({ health, term, conditional, page: { observation, conditional } });
  },
  restart: () => {
    const { health } = get();
    set({
      page: null,
      health: health.status === 'off' ? health : INITIAL_HEALTH,
    });
  },
  leave: () => {
    get().restart();
    set({ term: null });
  },
}));
