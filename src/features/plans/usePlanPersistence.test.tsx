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

  it('surfaces a refused schema without hydrating', async () => {
    render(
      <Harness
        repo={repoWith({ status: 'refused', reason: 'newer than known' })}
        adapter={fakeAdapter()}
      />,
    );
    await waitFor(() => {
      expect(storageIssueStore.getState().issue?.kind).toBe('refused');
    });
    expect(planStore.getState().plans).toHaveLength(0);
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
