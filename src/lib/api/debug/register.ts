// Installs the debug interceptors into the registry, wires the debug message
// dispatcher into the router, and exposes a service worker console handle so a
// tester can push requests through the full router and gateway. Reached only
// through the dynamic import guarded by IS_DEBUG in the background entrypoint, so
// the whole debug graph and its canary drop from production.

import { setAudit, setRecorder, setSimulation } from '../interceptors';
import {
  setDebugDispatch,
  type DebugDispatch,
  type RouterListener,
} from '../../messaging/router';
import { err, ok, unknownError } from '../../utils/result';
import type { RequestMessage } from '../../messaging/protocol';
import { createAuditInterceptor } from './audit';
import { createSimulationInterceptor } from './simulation';
import { createDebugState, type DebugState } from './state';

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface DebugHandle {
  send(message: RequestMessage): Promise<unknown>;
}

export function createDebugDispatch(
  state: DebugState,
  clearCache: () => Promise<void>,
): DebugDispatch {
  return (message) => {
    switch (message.type) {
      case 'debug/getRequestLog':
        return Promise.resolve(ok(state.getRequestLog()));
      case 'debug/getReport':
        return Promise.resolve(ok(state.getReport()));
      case 'debug/getLatestRaw':
        return Promise.resolve(ok(state.getLatestRaw()));
      case 'debug/getSimulation':
        return Promise.resolve(ok(state.getSettings()));
      case 'debug/clearCache':
        return clearCache().then(() => ok(undefined));
      case 'debug/setFixture':
        state.setSettings({ fixtureId: message.fixtureId });
        return Promise.resolve(ok(undefined));
      case 'debug/setFault':
        state.setSettings({ faultId: message.faultId });
        return Promise.resolve(ok(undefined));
      case 'debug/setMutation':
        state.setSettings({ mutationId: message.mutationId });
        return Promise.resolve(ok(undefined));
      default:
        return Promise.resolve(
          err(unknownError(`unhandled debug route ${message.type}`)),
        );
    }
  };
}

export interface InstallDebugDeps {
  extensionVersion: string;
  runtimeId: string;
  router: RouterListener;
  clearCache: () => Promise<void>;
  now?: () => string;
  fixtures?: Record<string, unknown>;
}

export function installDebug(deps: InstallDebugDeps): DebugState {
  const state = createDebugState();
  const now = deps.now ?? (() => new Date().toISOString());
  const fixtures = deps.fixtures ?? {};

  setRecorder(state.recorder);
  setAudit(
    createAuditInterceptor({
      extensionVersion: deps.extensionVersion,
      now,
      onReport: (report) => {
        state.setReport(report);
      },
      onRaw: (context, raw) => {
        // Only the teach table payload has a normalized counterpart to compare.
        if (context.endpoint === 'get-teach-table-show') {
          state.setLatestRaw({
            raw,
            request: { endpoint: context.endpoint, params: context.params },
          });
        }
      },
    }),
  );
  setSimulation(
    createSimulationInterceptor({
      getSettings: () => state.getSettings(),
      getFixture: (id) => fixtures[id],
    }),
  );
  setDebugDispatch(createDebugDispatch(state, deps.clearCache));

  // The worker cannot message itself, so the console handle calls the router
  // directly with a synthetic same-extension sender.
  const debugGlobal = globalThis as typeof globalThis & {
    __kcp?: DebugHandle;
  };
  debugGlobal.__kcp = {
    send: (message) =>
      deps.router(message, { id: deps.runtimeId }) ??
      Promise.resolve(err(unknownError('router dropped the message'))),
  };

  return state;
}
