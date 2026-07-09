import { describe, it, expect, afterEach } from 'vitest';
import type { Term } from '@/lib/routing/academicTerms';
import { makePlan } from '../../../tests/support/domain-builders';
import { planStore } from './planStore';
import { switchOrCreatePlanForTerm } from './switchPlanTerm';

const TERM_S1: Term = { year: '2569', semester: '1' };

afterEach(() => {
  planStore.setState({
    plans: [],
    activePlanId: null,
    entries: [],
    pendingUndo: null,
  });
});

describe('switchOrCreatePlanForTerm', () => {
  it('creates a plan when none exists for the term', () => {
    switchOrCreatePlanForTerm(TERM_S1);
    const state = planStore.getState();
    expect(state.plans).toHaveLength(1);
    expect(state.plans[0]?.semester).toBe('1');
    expect(state.activePlanId).toBe(state.plans[0]?.id);
  });

  it('activates the most recently updated existing plan for the term', () => {
    planStore.setState({
      plans: [
        makePlan({
          id: 'older',
          semester: '1',
          entries: [],
          updatedAt: '2026-01-01T00:00:00.001Z',
        }),
        makePlan({
          id: 'other',
          semester: '2',
          entries: [],
          updatedAt: '2026-01-01T00:00:00.500Z',
        }),
        makePlan({
          id: 'newer',
          semester: '1',
          entries: [],
          updatedAt: '2026-01-01T00:00:00.900Z',
        }),
      ],
      activePlanId: 'older',
      entries: [],
      pendingUndo: null,
    });

    switchOrCreatePlanForTerm(TERM_S1);
    // No new plan is created, and the newer first semester plan is activated.
    expect(planStore.getState().plans).toHaveLength(3);
    expect(planStore.getState().activePlanId).toBe('newer');
  });
});
