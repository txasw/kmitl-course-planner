// The registration helper's state (ADR-0076): the kits the prepare action built, the
// checklist marks the student set, the prepare run in flight, and which of the helper's
// surfaces are open. The kits and marks persist through the repositories bound at mount;
// the run and the surfaces are session memory only. Nothing here comes from the host page.

import { createStore } from 'zustand/vanilla';
import type { Plan } from '@/lib/domain/plan';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import {
  withMark,
  type ChecklistMark,
  type ChecklistMarks,
} from '@/lib/regis/checklist';
import type { ListRepository } from '@/lib/storage/regis';

export interface RegisRepositories {
  kits: ListRepository<RegistrationKit>;
  checklists: ListRepository<ChecklistMarks>;
}

/** The prepare action's progress for one plan. */
export type PrepareRun =
  | { status: 'idle' }
  | { status: 'running'; planId: string; done: number; total: number }
  | { status: 'done'; planId: string }
  | { status: 'cancelled'; planId: string }
  | { status: 'failed'; planId: string };

/** How far the phone sheet is raised. */
export type SheetLevel = 'peek' | 'half' | 'full';

export interface RegisState {
  loaded: boolean;
  kits: RegistrationKit[];
  checklists: ChecklistMarks[];
  run: PrepareRun;
  readinessOpen: boolean;
  dockOpen: boolean;
  /** Whether the desktop dock shows its full content rather than the narrow bar. */
  dockExpanded: boolean | null;
  sheetLevel: SheetLevel;
  hydrate: (kits: RegistrationKit[], checklists: ChecklistMarks[]) => void;
  saveKit: (kit: RegistrationKit) => void;
  setMark: (plan: Plan, subjectId: string, mark: ChecklistMark | null) => void;
  setRun: (run: PrepareRun) => void;
  setReadinessOpen: (open: boolean) => void;
  setDockOpen: (open: boolean) => void;
  setDockExpanded: (expanded: boolean) => void;
  setSheetLevel: (level: SheetLevel) => void;
}

let repositories: RegisRepositories | null = null;

/** Bind the storage the kits and marks persist to; the content script mount calls it. */
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
    checklists: [],
    run: { status: 'idle' },
    readinessOpen: false,
    dockOpen: false,
    dockExpanded: null,
    sheetLevel: 'peek',
    hydrate: (kits, checklists) => {
      set({ kits, checklists, loaded: true });
    },
    saveKit: (kit) => {
      set({ kits: replaceFor(get().kits, kit) });
      void repositories?.kits.put(kit.planId, kit);
    },
    setMark: (plan, subjectId, mark) => {
      const current =
        get().checklists.find((item) => item.planId === plan.id) ?? null;
      const next = withMark(current, plan, subjectId, mark);
      set({ checklists: replaceFor(get().checklists, next) });
      void repositories?.checklists.put(plan.id, next);
    },
    setRun: (run) => {
      set({ run });
    },
    setReadinessOpen: (readinessOpen) => {
      set({ readinessOpen });
    },
    setDockOpen: (dockOpen) => {
      set({ dockOpen });
    },
    setDockExpanded: (dockExpanded) => {
      set({ dockExpanded });
    },
    setSheetLevel: (sheetLevel) => {
      set({ sheetLevel });
    },
  }));
}

export const regisStore = createRegisStore();
