import { describe, expect, it } from 'vitest';
import { makePlan } from '../../../tests/support/domain-builders';
import { pickHelperPlan } from './helperPlan';
import type { Term } from '../routing/academicTerms';

const S1 = makePlan({
  id: 's1',
  semester: '1',
  updatedAt: '2026-11-20T00:00:00.000Z',
});
const S2A = makePlan({
  id: 's2a',
  semester: '2',
  updatedAt: '2026-11-01T00:00:00.000Z',
});
const S2B = makePlan({
  id: 's2b',
  semester: '2',
  updatedAt: '2026-11-10T00:00:00.000Z',
});
const PLANS = [S1, S2A, S2B];
const TERM2: Term = { year: '2569', semester: '2' };

function pick(
  activePlanId: string | null,
  pageTerm: Term | null,
  picked: string | null = null,
  options: { termPending?: boolean; rememberedTerm?: Term | null } = {},
) {
  return pickHelperPlan({
    plans: PLANS,
    activePlanId,
    pageTerm,
    termPending: options.termPending ?? false,
    rememberedTerm: options.rememberedTerm ?? null,
    pickedPlanId: picked,
  });
}

function planId(result: ReturnType<typeof pickHelperPlan>) {
  return result.kind === 'plan' ? result.plan.id : result.kind;
}

describe('pickHelperPlan', () => {
  it('falls back to the active plan, unconfirmed, once no reading can bring the term', () => {
    const result = pick('s1', null);
    expect(planId(result)).toBe('s1');
    expect(result.kind === 'plan' && result.confirmed).toBe(false);
    expect(planId(pick(null, null))).toBe('none');
  });

  it('names no plan while a reading may still bring the page term', () => {
    expect(pick('s1', null, null, { termPending: true })).toEqual({
      kind: 'reading',
    });
    // A remembered term is no proof of this page's term, so it names nothing either.
    expect(
      pick('s1', null, 's1', { termPending: true, rememberedTerm: TERM2 }),
    ).toEqual({ kind: 'reading' });
  });

  it('prefers a plan of the remembered term in the fallback, still unconfirmed', () => {
    const result = pick('s1', null, null, { rememberedTerm: TERM2 });
    expect(planId(result)).toBe('s2b');
    expect(result.kind === 'plan' && result.confirmed).toBe(false);
    expect(
      planId(
        pick('s1', null, null, {
          rememberedTerm: { year: '2570', semester: '1' },
        }),
      ),
    ).toBe('s1');
  });

  it('confirms a plan only when it is of the term read from the page', () => {
    const result = pick('s1', TERM2, null, { rememberedTerm: TERM2 });
    expect(result.kind === 'plan' && result.confirmed).toBe(true);
  });

  it('uses the active plan when it is of the page term', () => {
    expect(planId(pick('s2a', TERM2))).toBe('s2a');
  });

  it('uses the latest plan of the page term when the active plan is of another', () => {
    const result = pick('s1', TERM2);
    expect(planId(result)).toBe('s2b');
    expect(result.kind === 'plan' && result.termPlans.map((p) => p.id)).toEqual(
      ['s2a', 's2b'],
    );
  });

  it('honours a plan picked in the helper only when it is of the page term', () => {
    expect(planId(pick('s2b', TERM2, 's2a'))).toBe('s2a');
    expect(planId(pick('s2b', TERM2, 's1'))).toBe('s2b');
  });

  it('names the term when no plan of it exists', () => {
    expect(pick('s1', { year: '2570', semester: '1' })).toEqual({
      kind: 'noPlanForTerm',
      term: { year: '2570', semester: '1' },
    });
  });
});
