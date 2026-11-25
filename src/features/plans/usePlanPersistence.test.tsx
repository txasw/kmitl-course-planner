import { describe, it, expect, afterEach, onTestFinished, vi } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import {
  ok,
  err,
  storageError,
  type Result,
  type StorageError,
} from '@/lib/utils/result';
import { emptyRoot } from '@/lib/storage/repo';
import type {
  LoadOutcome,
  PersistedRoot,
  PlanRepository,
  StorageAdapter,
} from '@/lib/storage/repo';
import { makePlan } from '../../../tests/support/domain-builders';
import { statusStore } from '@/features/shell/statusStore';
import { toastStore, type Toast } from '@/features/shell/toastStore';
import { autosaveStore } from './autosaveStore';
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
  toastStore.getState().dismiss();
  vi.useRealTimers();
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

  it('reopens the plan last switched to after a reload, not the newest one', async () => {
    const older = makePlan({
      id: 'sem2',
      semester: '2',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    const newer = makePlan({
      id: 'sem1',
      semester: '1',
      updatedAt: '2026-11-20T00:00:00.000Z',
    });
    let saved: PersistedRoot = { schemaVersion: 1, plans: [older, newer] };
    const repo: PlanRepository = {
      load: () => Promise.resolve({ status: 'ok', root: saved }),
      save: (root) => {
        saved = root;
        return Promise.resolve(ok(undefined));
      },
    };
    const first = render(<Harness repo={repo} adapter={fakeAdapter()} />);
    await waitFor(() => {
      expect(planStore.getState().loaded).toBe(true);
    });
    expect(planStore.getState().activePlanId).toBe('sem1');
    // Switching alone changes no plan, and still saves the choice.
    act(() => {
      planStore.getState().setActivePlan('sem2');
    });
    await waitFor(
      () => {
        expect(saved.activePlanId).toBe('sem2');
      },
      { timeout: 1000 },
    );
    first.unmount();
    // A reload: a fresh store reads storage again.
    planStore.setState({
      plans: [],
      activePlanId: null,
      entries: [],
      loaded: false,
    });
    render(<Harness repo={repo} adapter={fakeAdapter()} />);
    await waitFor(() => {
      expect(planStore.getState().loaded).toBe(true);
    });
    expect(planStore.getState().activePlanId).toBe('sem2');
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
});

type SaveResult = Result<undefined, StorageError>;

/** A save whose outcomes the test settles one call at a time. */
function deferredSaves() {
  const pending: ((result: SaveResult) => void)[] = [];
  const save = vi.fn(
    () =>
      new Promise<SaveResult>((resolve) => {
        pending.push(resolve);
      }),
  );
  const settleNext = async (result: SaveResult) => {
    const resolve = pending.shift();
    if (resolve === undefined) throw new Error('no save in flight');
    await act(async () => {
      resolve(result);
      await Promise.resolve();
    });
  };
  return { save, settleNext };
}

/** Every toast raised from here on, in order. */
function recordToasts(): Toast[] {
  const shown: Toast[] = [];
  onTestFinished(
    toastStore.subscribe((state, previous) => {
      if (state.toast !== null && state.toast !== previous.toast) {
        shown.push(state.toast);
      }
    }),
  );
  return shown;
}

/** Every line handed to the status announcer from here on, in order. */
function recordLines(): string[] {
  const said: string[] = [];
  onTestFinished(
    statusStore.subscribe((state, previous) => {
      if (state.line !== null && state.line !== previous.line) {
        said.push(state.line.text);
      }
    }),
  );
  return said;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function mountWithSaves(save: PlanRepository['save']) {
  vi.useFakeTimers();
  const view = render(
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
  await advance(0);
  return view;
}

function edit() {
  act(() => {
    planStore.getState().createPlan('x', { year: '2569', semester: '1' });
  });
}

const failed = err(storageError('quota'));

describe('usePlanPersistence autosave state', () => {
  it('is off until the read settles and saved once the stored plans hydrate', async () => {
    expect(autosaveStore.getState().status).toBe('off');
    await mountWithSaves(deferredSaves().save);
    expect(autosaveStore.getState().status).toBe('saved');
  });

  it('stays off for a refused newer schema, which is never autosaved', async () => {
    vi.useFakeTimers();
    render(
      <Harness
        repo={repoWith({ status: 'refused', reason: 'newer than known' })}
        adapter={fakeAdapter()}
      />,
    );
    await advance(0);
    expect(autosaveStore.getState().status).toBe('off');
    expect(autosaveStore.getState().retry).toBeNull();
  });

  it('reads saving from the first change until the save settles', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    edit();
    expect(autosaveStore.getState().status).toBe('saving');
    await advance(299);
    expect(save).not.toHaveBeenCalled();
    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosaveStore.getState().status).toBe('saving');
    await settleNext(ok(undefined));
    expect(autosaveStore.getState().status).toBe('saved');
  });

  it('keeps saving while a newer change is still waiting to save', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    edit();
    await advance(300);
    edit();
    await settleNext(ok(undefined));
    expect(autosaveStore.getState().status).toBe('saving');
    await advance(300);
    await settleNext(ok(undefined));
    expect(autosaveStore.getState().status).toBe('saved');
  });

  it('lets only the latest save set the state when an older one settles late', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    edit();
    await advance(300);
    edit();
    await advance(300);
    expect(save).toHaveBeenCalledTimes(2);
    await settleNext(failed);
    expect(autosaveStore.getState().status).toBe('saving');
    expect(toasts).toHaveLength(0);
    await settleNext(ok(undefined));
    expect(autosaveStore.getState().status).toBe('saved');
  });

  it('speaks one line and raises no toast for a run of failed saves', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    const lines = recordLines();
    edit();
    await advance(300);
    await settleNext(failed);
    expect(autosaveStore.getState().status).toBe('failed');
    expect(lines).toEqual(['บันทึกตารางไม่สำเร็จ']);
    // The strip under the header shows the failure; a toast would repeat it over the
    // plan status row.
    expect(toasts).toHaveLength(0);

    edit();
    await advance(300);
    await settleNext(failed);
    expect(autosaveStore.getState().status).toBe('failed');
    expect(lines).toHaveLength(1);
  });

  it('raises nothing for a successful save', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    const lines = recordLines();
    edit();
    await advance(300);
    await settleNext(ok(undefined));
    expect(toasts).toHaveLength(0);
    expect(lines).toHaveLength(0);
  });

  it('announces a failure again once a save has succeeded', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const lines = recordLines();
    edit();
    await advance(300);
    await settleNext(failed);
    edit();
    await advance(300);
    await settleNext(ok(undefined));
    edit();
    await advance(300);
    await settleNext(failed);
    expect(lines).toHaveLength(2);
  });

  it('saves now from the retry', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    edit();
    await advance(300);
    await settleNext(failed);
    act(() => {
      autosaveStore.getState().retry?.();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(autosaveStore.getState().status).toBe('saving');
    await settleNext(ok(undefined));
    expect(autosaveStore.getState().status).toBe('saved');
  });

  it('announces a failed retry the student asked for', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const lines = recordLines();
    edit();
    await advance(300);
    await settleNext(failed);
    act(() => {
      autosaveStore.getState().retry?.();
    });
    await settleNext(failed);
    expect(lines).toHaveLength(2);
  });

  it('treats a rejected save as a failure', async () => {
    await mountWithSaves(() => Promise.reject(new Error('storage gone')));
    edit();
    await advance(300);
    expect(autosaveStore.getState().status).toBe('failed');
  });

  it('turns off on unmount', async () => {
    const { unmount } = await mountWithSaves(deferredSaves().save);
    unmount();
    expect(autosaveStore.getState().status).toBe('off');
    expect(autosaveStore.getState().retry).toBeNull();
  });
});
