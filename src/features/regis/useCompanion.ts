// The registration helper's view of the active plan: the plan's kit when one younger than
// the age limit exists, checked again against the plan as it stands, and the checklist
// derived from it and the student's marks. The page term is not read in this release, so
// the rows never enter the term mismatch state here and the dock asks the student to
// compare the term instead.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { Plan } from '@/lib/domain/plan';
import { isKitFresh, kitMatchesPlan, refitKit } from '@/lib/regis/kit';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { deriveChecklist, type Checklist } from '@/lib/regis/checklist';
import { planStore } from '@/features/plans/planStore';
import { activePlanOf } from '@/features/plans/planStoreState';
import { uiStore } from '@/features/shell/uiStore';
import { regisStore } from './regisStore';

export type KitState = 'none' | 'stale' | 'fresh';

export interface CompanionView {
  plan: Plan | null;
  /** The plan's kit as stored, fresh or not, for its prepared date. */
  storedKit: RegistrationKit | null;
  /** The fresh kit checked against the plan as it stands, or null. */
  kit: RegistrationKit | null;
  kitState: KitState;
  checklist: Checklist | null;
}

/** The kit stored for a plan in its current term, if any. */
export function storedKitFor(
  kits: readonly RegistrationKit[],
  plan: Plan | null,
): RegistrationKit | null {
  if (plan === null) return null;
  return kits.find((kit) => kitMatchesPlan(kit, plan)) ?? null;
}

export function useCompanionView(): CompanionView {
  const plan = useStore(planStore, (state) => activePlanOf(state) ?? null);
  const kits = useStore(regisStore, (state) => state.kits);
  const checklists = useStore(regisStore, (state) => state.checklists);
  const profile = useStore(uiStore, (state) => state.curriculumProfile);
  return useMemo(() => {
    const storedKit = storedKitFor(kits, plan);
    const fresh =
      storedKit !== null && isKitFresh(storedKit, Date.now())
        ? storedKit
        : null;
    const kit =
      fresh !== null && plan !== null
        ? refitKit(fresh, plan, profile?.curriculumId ?? null)
        : null;
    const kitState: KitState =
      storedKit === null ? 'none' : fresh === null ? 'stale' : 'fresh';
    const marks =
      plan === null
        ? null
        : (checklists.find((item) => item.planId === plan.id) ?? null);
    const checklist =
      plan === null
        ? null
        : deriveChecklist({ plan, kit, marks, pageTerm: null });
    return { plan, storedKit, kit, kitState, checklist };
  }, [plan, kits, checklists, profile]);
}
