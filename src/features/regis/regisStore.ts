// The registration helper's state (ADR-0076): the kits the prepare action built, the
// section groups the student chose for this registration, the prepare run in flight, and which of the helper's
// surfaces are open. The kits and choices persist through the repositories bound at mount;
// the run and the surfaces are session memory only. Nothing here comes from the host page.

import { createStore } from 'zustand/vanilla';
import type { Plan } from '@/lib/domain/plan';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { withChoice, type SectionChoices } from '@/lib/regis/choices';
import {
  DEFAULT_FILL_SETTINGS,
  type FillSettings,
  type FillSettingsRepository,
  type ListRepository,
} from '@/lib/storage/regis';

export interface RegisRepositories {
  kits: ListRepository<RegistrationKit>;
  choices: ListRepository<SectionChoices>;
  fill: FillSettingsRepository;
}

/** The prepare action's progress for one plan. */
export type PrepareRun =
  | { status: 'idle' }
  | { status: 'running'; planId: string; done: number; total: number }
  | { status: 'done'; planId: string }
  | { status: 'cancelled'; planId: string }
  | { status: 'failed'; planId: string };

export interface RegisState {
  loaded: boolean;
  kits: RegistrationKit[];
  choices: SectionChoices[];
  run: PrepareRun;
  readinessOpen: boolean;
  /** The student's fill switch and the host builds fill is latched off for. */
  fill: FillSettings;
  hydrate: (kits: RegistrationKit[], choices: SectionChoices[]) => void;
  hydrateFill: (fill: FillSettings) => void;
  setFillOff: (off: boolean) => void;
  /** Latch fill off for a host build after an actuator refusal (ADR-0078). */
  latchBuild: (key: string) => void;
  saveKit: (kit: RegistrationKit) => void;
  /** Choose a kit group for one subject in this registration, or null for the plan's. */
  setChoice: (
    plan: Plan,
    subjectId: string,
    ids: readonly string[] | null,
  ) => void;
  setRun: (run: PrepareRun) => void;
  setReadinessOpen: (open: boolean) => void;
}

let repositories: RegisRepositories | null = null;

/** Bind the storage the kits and choices persist to; the content script mount calls it. */
export function bindRegisRepositories(repos: RegisRepositories | null): void {
  repositories = repos;
}

function replaceFor<T extends { planId: string }>(items: T[], item: T): T[] {
  return [item, ...items.filter((entry) => entry.planId !== item.planId)];
}

function createRegisStore() {
  return createStore<RegisState>()((set, get) => ({
    loaded: false,
    kits: [],
    choices: [],
    run: { status: 'idle' },
    readinessOpen: false,
    fill: DEFAULT_FILL_SETTINGS,
    hydrate: (kits, choices) => {
      set({ kits, choices, loaded: true });
    },
    hydrateFill: (fill) => {
      set({ fill });
    },
    setFillOff: (off) => {
      const fill = { ...get().fill, off };
      set({ fill });
      void repositories?.fill.save(fill);
    },
    latchBuild: (key) => {
      const { fill } = get();
      if (fill.latched.includes(key)) return;
      const next = { ...fill, latched: [...fill.latched, key].slice(-20) };
      set({ fill: next });
      void repositories?.fill.save(next);
    },
    saveKit: (kit) => {
      set({ kits: replaceFor(get().kits, kit) });
      void repositories?.kits.put(kit.planId, kit);
    },
    setChoice: (plan, subjectId, ids) => {
      const current =
        get().choices.find((item) => item.planId === plan.id) ?? null;
      const next = withChoice(current, plan, subjectId, ids);
      set({ choices: replaceFor(get().choices, next) });
      void repositories?.choices.put(plan.id, next);
    },
    setRun: (run) => {
      set({ run });
    },
    setReadinessOpen: (readinessOpen) => {
      set({ readinessOpen });
    },
  }));
}

export const regisStore = createRegisStore();
