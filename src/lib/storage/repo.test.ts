import { describe, it, expect } from 'vitest';
import { makePlan } from '../../../tests/support/domain-builders';
import { ROOT_KEY, quarantineKey } from './keys';
import {
  createPlanRepository,
  emptyRoot,
  type PersistedRoot,
  type StorageAdapter,
} from './repo';

function memoryAdapter(initial: Record<string, unknown> = {}): {
  adapter: StorageAdapter;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>(Object.entries(initial));
  const adapter: StorageAdapter = {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
  return { adapter, store };
}

describe('createPlanRepository', () => {
  it('reports a fresh root when nothing is stored', async () => {
    const { adapter } = memoryAdapter();
    const outcome = await createPlanRepository(adapter).load();
    expect(outcome.status).toBe('fresh');
    if (outcome.status === 'fresh') {
      expect(outcome.root.plans).toEqual([]);
    }
  });

  it('round trips a saved root', async () => {
    const { adapter } = memoryAdapter();
    const repo = createPlanRepository(adapter);
    const root: PersistedRoot = { ...emptyRoot(), plans: [makePlan()] };
    expect((await repo.save(root)).ok).toBe(true);
    const outcome = await repo.load();
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.root.plans).toHaveLength(1);
    }
  });

  it('applies migrations for an older stored schema', async () => {
    const { adapter } = memoryAdapter({
      [ROOT_KEY]: { schemaVersion: 0, plans: [] },
    });
    const repo = createPlanRepository(adapter, {
      migrations: [{ to: 1, migrate: () => ({ schemaVersion: 1, plans: [] }) }],
    });
    expect((await repo.load()).status).toBe('ok');
  });

  it('refuses a schema newer than the build knows', async () => {
    const { adapter } = memoryAdapter({
      [ROOT_KEY]: { schemaVersion: 999, plans: [] },
    });
    const outcome = await createPlanRepository(adapter, {
      now: () => 'T0',
    }).load();
    expect(outcome.status).toBe('refused');
    if (outcome.status === 'refused') {
      expect(outcome.reason).toMatch(/newer/);
    }
  });

  it('quarantines a structurally invalid root and starts fresh', async () => {
    const corrupt = { schemaVersion: 1, plans: 'not an array' };
    const { adapter, store } = memoryAdapter({ [ROOT_KEY]: corrupt });
    const outcome = await createPlanRepository(adapter, {
      now: () => 'T0',
    }).load();
    expect(outcome.status).toBe('quarantined');
    if (outcome.status === 'quarantined') {
      expect(outcome.quarantineKey).toBe(quarantineKey('T0'));
      expect(outcome.root.plans).toEqual([]);
    }
    expect(store.get(quarantineKey('T0'))).toEqual(corrupt);
    expect(store.get(ROOT_KEY)).toEqual(emptyRoot());
  });

  it('quarantines an invalid plan and keeps the valid ones', async () => {
    const valid = makePlan({ id: 'good' });
    const invalidPlan = { id: 'bad' };
    const { adapter, store } = memoryAdapter({
      [ROOT_KEY]: { schemaVersion: 1, plans: [valid, invalidPlan] },
    });
    const outcome = await createPlanRepository(adapter, {
      now: () => 'T1',
    }).load();
    expect(outcome.status).toBe('quarantined');
    if (outcome.status === 'quarantined') {
      expect(outcome.root.plans).toHaveLength(1);
      expect(outcome.root.plans[0]?.id).toBe('good');
      expect(outcome.quarantineKey).toBe(quarantineKey('T1'));
    }
    expect(store.get(quarantineKey('T1'))).toEqual([invalidPlan]);
    expect(store.get(ROOT_KEY)).toEqual({ schemaVersion: 1, plans: [valid] });
  });

  it('quarantines a non object blob using the default clock', async () => {
    const { adapter, store } = memoryAdapter({ [ROOT_KEY]: 'garbage' });
    const outcome = await createPlanRepository(adapter).load();
    expect(outcome.status).toBe('quarantined');
    const quarantined = [...store.keys()].filter((key) =>
      key.startsWith('kcp:quarantine:'),
    );
    expect(quarantined).toHaveLength(1);
  });

  it('refuses to persist an invalid root', async () => {
    const { adapter } = memoryAdapter();
    // Deliberately malformed root to exercise the defensive validation on save;
    // the cast is confined to this test fixture.
    const broken = {
      schemaVersion: 1,
      plans: [{ id: 'x' }],
    } as unknown as PersistedRoot;
    const result = await createPlanRepository(adapter).save(broken);
    expect(result.ok).toBe(false);
  });
});
