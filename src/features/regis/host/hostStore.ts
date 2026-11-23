// What the read only observer last saw on the pre registration page (ADR-0077), in
// memory only: its health, the latest healthy observation, and the prerequisite ids the
// grade not announced dialog named for each planned subject. The conditional ids outlive
// the dialog and the subject reaching the list until the page reloads, since only the
// dialog says so. Nothing here is stored, logged, or sent.

import { createStore } from 'zustand/vanilla';
import type { ObservedPage } from '@/lib/regis/observedRow';
import {
  INITIAL_HEALTH,
  nextHealth,
  type Gate,
  type ObserverHealth,
} from '@/lib/regis/observerHealth';
import type { PageReading } from './hostDom';

export interface HostState {
  health: ObserverHealth;
  page: ObservedPage | null;
  conditional: Readonly<Record<string, readonly string[]>>;
  record: (gate: Gate, reading: PageReading) => void;
  /** Forget the page when the student leaves it; an off state lasts the document. */
  leave: () => void;
}

export const hostStore = createStore<HostState>()((set, get) => ({
  health: INITIAL_HEALTH,
  page: null,
  conditional: {},
  record: (gate, reading) => {
    const health = nextHealth(get().health, gate, reading.reading);
    if (health.status !== 'healthy' || reading.reading !== 'ok') {
      set({ health, page: null });
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
    set({ health, conditional, page: { observation, conditional } });
  },
  leave: () => {
    const { health } = get();
    set({
      page: null,
      health: health.status === 'off' ? health : INITIAL_HEALTH,
    });
  },
}));
