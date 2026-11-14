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
  PlanRepository,
  StorageAdapter,
} from '@/lib/storage/repo';
import { makePlan } from '../../../tests/support/domain-builders';
import { toastStore, type Toast } from '@/features/shell/toastStore';
import { autosaveStore, SAVE_INDICATOR_ID } from './autosaveStore';
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

  it('raises one error toast with a retry for a run of failed saves', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    edit();
    await advance(300);
    await settleNext(failed);
    expect(autosaveStore.getState().status).toBe('failed');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.kind).toBe('error');
    expect(toasts[0]?.message).toBe('บันทึกตารางไม่สำเร็จ');
    expect(toasts[0]?.action?.label).toBe('ลองอีกครั้ง');

    edit();
    await advance(300);
    await settleNext(failed);
    expect(autosaveStore.getState().status).toBe('failed');
    expect(toasts).toHaveLength(1);
  });

  it('raises nothing for a successful save', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    edit();
    await advance(300);
    await settleNext(ok(undefined));
    expect(toasts).toHaveLength(0);
  });

  it('announces a failure again once a save has succeeded', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    edit();
    await advance(300);
    await settleNext(failed);
    edit();
    await advance(300);
    await settleNext(ok(undefined));
    edit();
    await advance(300);
    await settleNext(failed);
    expect(toasts).toHaveLength(2);
  });

  it('saves now from the toast retry and moves focus to the indicator', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    const indicator = document.createElement('span');
    indicator.id = SAVE_INDICATOR_ID;
    indicator.tabIndex = -1;
    const control = document.createElement('button');
    document.body.append(indicator, control);
    try {
      edit();
      await advance(300);
      await settleNext(failed);
      act(() => {
        toasts[0]?.action?.run(control);
      });
      expect(save).toHaveBeenCalledTimes(2);
      expect(autosaveStore.getState().status).toBe('saving');
      expect(document.activeElement).toBe(indicator);
      await settleNext(ok(undefined));
      expect(autosaveStore.getState().status).toBe('saved');
    } finally {
      indicator.remove();
      control.remove();
    }
  });

  it('announces a failed retry the student asked for', async () => {
    const { save, settleNext } = deferredSaves();
    await mountWithSaves(save);
    const toasts = recordToasts();
    edit();
    await advance(300);
    await settleNext(failed);
    act(() => {
      autosaveStore.getState().retry?.();
    });
    await settleNext(failed);
    expect(toasts).toHaveLength(2);
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
