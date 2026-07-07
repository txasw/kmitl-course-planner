// The simulation interceptor turns the current debug settings into a directive the
// gateway acts on: a fault replaces the network attempt, a fixture replaces the
// response, and a mutation post processes the fetched payload. A fault takes
// precedence, then a fixture, then a mutation. Debug only module; dropped from
// production and its canary never ships.

import { MUTATION_PRESETS } from '../../contract/mutations';
import { findFault } from './faults';
import type { SimDirective, SimulationInterceptor } from '../interceptors';
import type { SimSettings } from '../types';

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface SimulationDeps {
  getSettings: () => SimSettings;
  getFixture: (id: string) => unknown;
}

export function createSimulationInterceptor(
  deps: SimulationDeps,
): SimulationInterceptor {
  return {
    intercept(): SimDirective | null {
      const { fixtureId, faultId, mutationId } = deps.getSettings();
      if (faultId) {
        const fault = findFault(faultId);
        if (fault) {
          return { kind: 'fault', fault: fault.outcome };
        }
      }
      if (fixtureId) {
        const response = deps.getFixture(fixtureId);
        if (response !== undefined) {
          return { kind: 'fixture', response };
        }
      }
      if (mutationId) {
        const preset = MUTATION_PRESETS.find(
          (entry) => entry.id === mutationId,
        );
        if (preset) {
          return { kind: 'mutate', mutate: (raw) => preset.apply(raw) };
        }
      }
      return null;
    },
  };
}
