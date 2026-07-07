import { describe, expect, it } from 'vitest';
import { createSimulationInterceptor } from './simulation';
import type { RequestContext, SimSettings } from '../types';

const context: RequestContext = { endpoint: 'e', params: {}, url: 'u' };
const none: SimSettings = { fixtureId: null, faultId: null, mutationId: null };

function sim(settings: SimSettings, fixtures: Record<string, unknown> = {}) {
  return createSimulationInterceptor({
    getSettings: () => settings,
    getFixture: (id) => fixtures[id],
  });
}

describe('createSimulationInterceptor', () => {
  it('returns null when no simulation is active', () => {
    expect(sim(none).intercept(context)).toBeNull();
  });

  it('returns a fault directive for a known fault id', () => {
    expect(sim({ ...none, faultId: 'timeout' }).intercept(context)).toEqual({
      kind: 'fault',
      fault: { kind: 'timeout' },
    });
  });

  it('returns a fixture directive for a known fixture id', () => {
    expect(
      sim({ ...none, fixtureId: 'f' }, { f: [{ x: 1 }] }).intercept(context),
    ).toEqual({ kind: 'fixture', response: [{ x: 1 }] });
  });

  it('returns a mutate directive for a known mutation id', () => {
    const directive = sim({
      ...none,
      mutationId: 'inject_unknown_field',
    }).intercept(context);
    expect(directive?.kind).toBe('mutate');
  });

  it('prefers a fault over a fixture and a mutation', () => {
    const directive = sim(
      {
        fixtureId: 'f',
        faultId: 'network_error',
        mutationId: 'inject_unknown_field',
      },
      { f: [] },
    ).intercept(context);
    expect(directive?.kind).toBe('fault');
  });

  it('ignores an unknown fixture id', () => {
    expect(
      sim({ ...none, fixtureId: 'missing' }).intercept(context),
    ).toBeNull();
  });
});
