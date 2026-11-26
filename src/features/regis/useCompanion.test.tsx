import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { Plan } from '@/lib/domain/plan';
import { INITIAL_HEALTH } from '@/lib/regis/observerHealth';
import type { Term } from '@/lib/routing/academicTerms';
import { makePlan } from '../../../tests/support/domain-builders';
import { planStore } from '@/features/plans/planStore';
import { hostStore } from './host/hostStore';
import { pickHelperPlanId, startVisit } from './helperStore';
import { useCompanionView } from './useCompanion';

// The helper follows the term the page registers, not the planner's active plan, and
// never changes the active plan while it does.

const SEM1 = makePlan({
  id: 'sem1',
  name: 'ตาราง 1/2569',
  semester: '1',
  updatedAt: '2026-11-20T00:00:00.000Z',
});
const SEM2 = makePlan({
  id: 'sem2',
  name: 'ตาราง 2/2569',
  semester: '2',
  updatedAt: '2026-11-01T00:00:00.000Z',
});
const SEM2B = makePlan({
  id: 'sem2b',
  name: 'ตาราง 2/2569 สำรอง',
  semester: '2',
  updatedAt: '2026-10-01T00:00:00.000Z',
});
const OPEN = { surrogate: false, build: 'tested' as const };

function pageShowing(term: Term) {
  hostStore.getState().record(OPEN, {
    reading: 'ok',
    observation: {
      step: 2,
      term,
      card: null,
      list: [],
      credits: null,
      dialog: null,
      toasts: [],
      results: null,
    },
  });
}

function withPlans(plans: Plan[], active: string) {
  act(() => {
    planStore.getState().hydrate(plans);
    planStore.getState().setActivePlan(active);
  });
}

afterEach(() => {
  cleanup();
  startVisit();
  hostStore.setState({
    health: INITIAL_HEALTH,
    page: null,
    term: null,
    conditional: {},
  });
  planStore.setState({
    plans: [],
    activePlanId: null,
    entries: [],
    loaded: false,
  });
});

describe('the helper plan', () => {
  it('is the plan of the page term, not the active plan of another term', () => {
    withPlans([SEM1, SEM2], 'sem1');
    act(() => {
      pageShowing({ year: '2569', semester: '2' });
    });
    const { result } = renderHook(() => useCompanionView());
    expect(result.current.plan?.id).toBe('sem2');
    expect(result.current.checklist?.termMismatch).toBe(false);
    expect(planStore.getState().activePlanId).toBe('sem1');
  });

  it('keeps following the page term after a later reading drifts', () => {
    withPlans([SEM1, SEM2], 'sem1');
    act(() => {
      pageShowing({ year: '2569', semester: '2' });
      hostStore.getState().record(OPEN, { reading: 'drift' });
    });
    const { result } = renderHook(() => useCompanionView());
    expect(result.current.plan?.id).toBe('sem2');
  });

  it('is the one picked in the helper among the plans of the page term', () => {
    withPlans([SEM1, SEM2, SEM2B], 'sem1');
    act(() => {
      pageShowing({ year: '2569', semester: '2' });
      pickHelperPlanId('sem2b');
    });
    const { result } = renderHook(() => useCompanionView());
    expect(result.current.plan?.id).toBe('sem2b');
    expect(
      result.current.pick.kind === 'plan' &&
        result.current.pick.termPlans.map((plan) => plan.id),
    ).toEqual(['sem2', 'sem2b']);
    expect(planStore.getState().activePlanId).toBe('sem1');
  });

  it('names the term when no plan is for it, leaving the active plan', () => {
    withPlans([SEM1], 'sem1');
    act(() => {
      pageShowing({ year: '2569', semester: '2' });
    });
    const { result } = renderHook(() => useCompanionView());
    expect(result.current.pick).toEqual({
      kind: 'noPlanForTerm',
      term: { year: '2569', semester: '2' },
    });
    expect(result.current.checklist).toBeNull();
    expect(planStore.getState().activePlanId).toBe('sem1');
  });

  it('is the active plan for the prepare card, whatever the page registers', () => {
    withPlans([SEM1, SEM2], 'sem1');
    act(() => {
      pageShowing({ year: '2569', semester: '2' });
    });
    const { result } = renderHook(() => useCompanionView('active'));
    expect(result.current.plan?.id).toBe('sem1');
  });
});
