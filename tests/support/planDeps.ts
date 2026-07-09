import { ok } from '../../src/lib/utils/result';
import { emptyRoot } from '../../src/lib/storage/repo';
import type { PlanPersistenceDeps } from '../../src/features/plans/usePlanPersistence';

/** Inert plan persistence deps for tests that render the App shell but do not
 * exercise storage: load reports a fresh root and save always succeeds. */
export function fakePlanDeps(): PlanPersistenceDeps {
  return {
    repo: {
      load: () => Promise.resolve({ status: 'fresh', root: emptyRoot() }),
      save: () => Promise.resolve(ok(undefined)),
    },
    adapter: {
      get: () => Promise.resolve(undefined),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    },
  };
}
