import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ok, err, storageError } from '@/lib/utils/result';
import { emptyRoot } from '@/lib/storage/repo';
import type {
  LoadOutcome,
  PlanRepository,
  StorageAdapter,
} from '@/lib/storage/repo';
import { makePlan } from '../../../tests/support/domain-builders';
import { planStore } from './planStore';
import { storageIssueStore } from './storageIssueStore';
import {
  usePlanPersistence,
  type PlanPersistenceDeps,
} from './usePlanPersistence';

function Harness(deps: PlanPersistenceDeps) {
  usePlanPersistence(deps);
  return null;
}

function fakeAdapter(initial: Record<string, unknown> = {}): StorageAdapter {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
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
}

function repoWith(
  outcome: LoadOutcome,
  save: PlanRepository['save'] = () => Promise.resolve(ok(undefined)),
): PlanRepository {
  return { load: () => Promise.resolve(outcome), save };
}

afterEach(() => {
  cleanup();
  planStore.setState({
    plans: [],
    activePlanId: null,
    entries: [],
    pendingUndo: null,
    loaded: false,
  });
  storageIssueStore.getState().setIssue(null);
});

describe('usePlanPersistence', () => {
  it('hydrates the stored plans on mount', async () => {
    const plan = makePlan({ id: 'stored' });
    render(
      <Harness
        repo={repoWith({
          status: 'ok',
          root: { schemaVersion: 1, plans: [plan] },
        })}
        adapter={fakeAdapter()}
      />,
    );
    await waitFor(() => {
      expect(planStore.getState().plans.map((p) => p.id)).toEqual(['stored']);
    });
    expect(planStore.getState().loaded).toBe(true);
  });

  it('stays unloaded until the read settles', async () => {
    let settle: (outcome: LoadOutcome) => void = () => undefined;
    const repo: PlanRepository = {
      load: () =>
        new Promise<LoadOutcome>((resolve) => {
          settle = resolve;
        }),
      save: () => Promise.resolve(ok(undefined)),
    };
    render(<Harness repo={repo} adapter={fakeAdapter()} />);
    expect(planStore.getState().loaded).toBe(false);
    settle({ status: 'ok', root: emptyRoot() });
    await waitFor(() => {
      expect(planStore.getState().loaded).toBe(true);
    });
  });

  it('marks the load settled after a rejected read and still autosaves', async () => {
    const save = vi.fn(() => Promise.resolve(ok(undefined)));
    const repo: PlanRepository = {
      load: () => Promise.reject(new Error('storage unavailable')),
      save,
    };
    render(<Harness repo={repo} adapter={fakeAdapter()} />);
    await waitFor(() => {
      expect(planStore.getState().loaded).toBe(true);
    });
    expect(planStore.getState().plans).toHaveLength(0);
    planStore.getState().createPlan('x', { year: '2569', semester: '1' });
    await waitFor(
      () => {
        expect(save).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it('surfaces a quarantine issue with the set aside data', async () => {
    render(
      <Harness
        repo={repoWith({
          status: 'quarantined',
          root: emptyRoot(),
          quarantineKey: 'kcp:quarantine:T',
        })}
        adapter={fakeAdapter({ 'kcp:quarantine:T': [{ bad: true }] })}
      />,
    );
    await waitFor(() => {
      expect(storageIssueStore.getState().issue?.kind).toBe('quarantined');
    });
    const issue = storageIssueStore.getState().issue;
    expect(issue?.kind === 'quarantined' && issue.data).toContain('bad');
  });

  it('surfaces a refused schema without hydrating or autosaving over it', async () => {
    const save = vi.fn(() => Promise.resolve(ok(undefined)));
    render(
      <Harness
        repo={repoWith({ status: 'refused', reason: 'newer than known' }, save)}
        adapter={fakeAdapter()}
      />,
    );
    await waitFor(() => {
      expect(storageIssueStore.getState().issue?.kind).toBe('refused');
    });
    expect(planStore.getState().loaded).toBe(true);
    expect(planStore.getState().plans).toHaveLength(0);
    // A later edit must not autosave, or it would overwrite the newer schema blob.
    planStore.getState().createPlan('x', { year: '2569', semester: '1' });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 400);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('autosaves a plan mutation after the debounce', async () => {
    const save = vi.fn(() => Promise.resolve(ok(undefined)));
    render(
      <Harness
        repo={repoWith(
          {
            status: 'ok',
            root: { schemaVersion: 1, plans: [makePlan({ id: 'stored' })] },
          },
          save,
        )}
        adapter={fakeAdapter()}
      />,
    );
    // Hydration and the store subscription attach together, so a visible hydrate
    // means the subscription is live.
    await waitFor(() => {
      expect(planStore.getState().plans).toHaveLength(1);
    });
    planStore.getState().createPlan('x', { year: '2569', semester: '1' });
    await waitFor(
      () => {
        expect(save).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it('reports a refused save as a storage issue', async () => {
    const save = vi.fn(() => Promise.resolve(err(storageError('bad'))));
    render(
      <Harness
        repo={repoWith(
          {
            status: 'ok',
            root: { schemaVersion: 1, plans: [makePlan({ id: 'stored' })] },
          },
          save,
        )}
        adapter={fakeAdapter()}
      />,
    );
    await waitFor(() => {
      expect(planStore.getState().plans).toHaveLength(1);
    });
    planStore.getState().createPlan('x', { year: '2569', semester: '1' });
    await waitFor(
      () => {
        expect(storageIssueStore.getState().issue?.kind).toBe('saveRefused');
      },
      { timeout: 1000 },
    );
  });
});
