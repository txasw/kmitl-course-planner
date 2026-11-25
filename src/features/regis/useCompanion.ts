// The registration helper's view of the active plan: which companion page is open, the
// plan's kit when one younger than the age limit exists, checked again against the plan
// as it stands, and the checklist derived from it, the student's choices, and what the read
// only observer last saw on the page while healthy (ADR-0077), including the page term,
// which puts every row in the term mismatch state when it differs from the plan.

import { useMemo, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type { Plan } from '@/lib/domain/plan';
import { companionRoute, type CompanionRoute } from '@/lib/regis/route';
import { isKitFresh, kitMatchesPlan, refitKit } from '@/lib/regis/kit';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { deriveChecklist, type Checklist } from '@/lib/regis/checklist';
import type { ObserverHealth } from '@/lib/regis/observerHealth';
import type { Term } from '@/lib/routing/academicTerms';
import { pickHelperPlan, type HelperPlanPick } from '@/lib/regis/helperPlan';
import { planStore } from '@/features/plans/planStore';
import { readLocationHash } from '@/features/shell/hostLocation';
import { uiStore } from '@/features/shell/uiStore';
import { subscribeHashRoute } from '@/features/search/useHashRoute';
import { regisStore } from './regisStore';
import { hostStore } from './host/hostStore';
import { helperStore } from './helperStore';

function currentCompanionRoute(): CompanionRoute | null {
  return companionRoute(readLocationHash());
}

/** The companion page on screen, kept current across host navigation. */
export function useCompanionRoute(): CompanionRoute | null {
  return useSyncExternalStore(
    subscribeHashRoute,
    currentCompanionRoute,
    currentCompanionRoute,
  );
}

export type KitState = 'none' | 'stale' | 'fresh';

/**
 * Which plan a view follows: the helper's, of the term the page registers, or the
 * planner's active plan, as the prepare card in the planner does.
 */
export type PlanSource = 'helper' | 'active';

/**
 * The plan the helper shows: of the page term when the page term is known, and never by
 * changing the planner's active plan. The active source ignores the page.
 */
export function useHelperPlanPick(
  source: PlanSource = 'helper',
): HelperPlanPick {
  const plans = useStore(planStore, (state) => state.plans);
  const activePlanId = useStore(planStore, (state) => state.activePlanId);
  const term = useStore(hostStore, (state) => state.term);
  const picked = useStore(helperStore, (state) => state.planId);
  const pageTerm = source === 'helper' ? term : null;
  const pickedPlanId = source === 'helper' ? picked : null;
  return useMemo(
    () => pickHelperPlan({ plans, activePlanId, pageTerm, pickedPlanId }),
    [plans, activePlanId, pageTerm, pickedPlanId],
  );
}

export interface CompanionView {
  /** Which plan the helper follows, or why it has none. */
  pick: HelperPlanPick;
  plan: Plan | null;
  /** The plan's kit as stored, fresh or not, for its prepared date. */
  storedKit: RegistrationKit | null;
  /** The fresh kit checked against the plan as it stands, or null. */
  kit: RegistrationKit | null;
  kitState: KitState;
  checklist: Checklist | null;
  health: ObserverHealth;
  /** The term the page shows while the observer is healthy, the term no plan is for, or null. */
  pageTerm: Term | null;
}

/** The kit stored for a plan in its current term, if any. */
export function storedKitFor(
  kits: readonly RegistrationKit[],
  plan: Plan | null,
): RegistrationKit | null {
  if (plan === null) return null;
  return kits.find((kit) => kitMatchesPlan(kit, plan)) ?? null;
}

export function useCompanionView(source: PlanSource = 'helper'): CompanionView {
  const pick = useHelperPlanPick(source);
  const plan = pick.kind === 'plan' ? pick.plan : null;
  const kits = useStore(regisStore, (state) => state.kits);
  const choices = useStore(regisStore, (state) => state.choices);
  const profile = useStore(uiStore, (state) => state.curriculumProfile);
  const page = useStore(hostStore, (state) => state.page);
  const health = useStore(hostStore, (state) => state.health);
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
    const pageTerm =
      pick.kind === 'noPlanForTerm'
        ? pick.term
        : (page?.observation.term ?? null);
    const kitState: KitState =
      storedKit === null ? 'none' : fresh === null ? 'stale' : 'fresh';
    const chosen =
      plan === null
        ? null
        : (choices.find((item) => item.planId === plan.id) ?? null);
    const checklist =
      plan === null
        ? null
        : deriveChecklist({ plan, kit, choices: chosen, pageTerm, page });
    return {
      pick,
      plan,
      storedKit,
      kit,
      kitState,
      checklist,
      health,
      pageTerm,
    };
  }, [pick, plan, kits, choices, profile, page, health]);
}
