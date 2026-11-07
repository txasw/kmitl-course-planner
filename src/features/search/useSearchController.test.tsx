import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  renderHook,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import type {
  SearchState,
  SearchStateRepository,
} from '@/lib/storage/lastSearch';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import { currentTermSchema, type RawCurrentTerm } from '@/lib/domain/schemas';
import {
  buddhistYears,
  toBuddhistYear,
  type Term,
} from '@/lib/routing/academicTerms';
import type { RequestMessage } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { networkError, err, ok, type Result } from '@/lib/utils/result';
import { loadFixture } from '../../../tests/support/fixtures';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from './searchStore';
import type { SearchDeps } from './SearchDepsContext';
import { useSearchActions, useSearchInit } from './useSearchController';

const term = { year: '2569', semester: '1' } as const;
const capture = currentTermSchema.parse(
  loadFixture('year-semester-now.capture.json'),
);
const fallback: Term = {
  year: buddhistYears(toBuddhistYear(new Date().getFullYear())).at(-1) ?? '',
  semester: '1',
};

function persistedState(): SearchState {
  return {
    schemaVersion: 2,
    activeTab: 'by_subject_id',
    term,
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
  };
}

function repoReturning(state: SearchState | null): SearchStateRepository {
  return { load: () => Promise.resolve(state), save: () => Promise.resolve() };
}

interface ControlledSend {
  send: TypedSend;
  requested: () => boolean;
  answer: (result: Result<RawCurrentTerm>) => Promise<void>;
}

// A send whose current term answer the test releases, so the fallback can be
// observed before the registrar replies. The cast is required because a single
// arrow cannot satisfy the generic send signature.
function controlledSend(): ControlledSend {
  let release: ((result: Result<RawCurrentTerm>) => void) | null = null;
  let pending: Promise<Result<RawCurrentTerm>> | null = null;
  const handler = (message: RequestMessage) => {
    if (message.type !== 'ref/currentTerm') {
      return Promise.resolve(ok(null));
    }
    pending = new Promise<Result<RawCurrentTerm>>((resolve) => {
      release = resolve;
    });
    return pending;
  };
  return {
    send: handler as unknown as TypedSend,
    requested: () => pending !== null,
    answer: async (result) => {
      release?.(result);
      await pending;
    },
  };
}

function formTerm(): Term {
  return searchStore.getState().term;
}

function InitProbe({ deps }: { deps: SearchDeps }) {
  useSearchInit(deps, null);
  return null;
}

beforeEach(() => {
  const state = searchStore.getState();
  state.hydrate({
    schemaVersion: 2,
    activeTab: 'by_class',
    term,
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
  });
  state.setInitialized(false);
  planStore.getState().hydrate([]);
});

afterEach(cleanup);

describe('useSearchInit', () => {
  it('hydrates the persisted search once', async () => {
    const { send } = controlledSend();
    render(
      <InitProbe deps={{ send, repo: repoReturning(persistedState()) }} />,
    );
    await waitFor(() => {
      expect(searchStore.getState().activeTab).toBe('by_subject_id');
    });
    expect(searchStore.getState().hasInitialized).toBe(true);
  });

  it('does not re-hydrate on a remount, preserving in session edits', async () => {
    const { send } = controlledSend();
    const deps = { send, repo: repoReturning(persistedState()) };
    const first = render(<InitProbe deps={deps} />);
    await waitFor(() => {
      expect(searchStore.getState().activeTab).toBe('by_subject_id');
    });
    // An in session edit after the first initialization.
    searchStore.getState().setActiveTab('by_class');
    first.unmount();
    // Reopening the overlay remounts the form; init must not run again.
    render(<InitProbe deps={deps} />);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(searchStore.getState().activeTab).toBe('by_class');
  });

  it('keeps a persisted term and never asks the registrar', async () => {
    const controlled = controlledSend();
    render(
      <InitProbe
        deps={{
          send: controlled.send,
          repo: repoReturning(persistedState()),
        }}
      />,
    );
    await waitFor(() => {
      expect(searchStore.getState().activeTab).toBe('by_subject_id');
    });
    expect(controlled.requested()).toBe(false);
    expect(formTerm()).toEqual(term);
  });

  it('renders the fallback, then applies the term after the current one', async () => {
    const controlled = controlledSend();
    render(
      <InitProbe deps={{ send: controlled.send, repo: repoReturning(null) }} />,
    );
    await waitFor(() => {
      expect(controlled.requested()).toBe(true);
    });
    expect(formTerm()).toEqual(fallback);
    await controlled.answer(ok(capture));
    const next = { year: '2569', semester: '2' };
    expect(formTerm()).toEqual(next);
  });

  it('leaves a term the student edited before the answer', async () => {
    const controlled = controlledSend();
    render(
      <InitProbe deps={{ send: controlled.send, repo: repoReturning(null) }} />,
    );
    await waitFor(() => {
      expect(controlled.requested()).toBe(true);
    });
    // Picking the value already shown still counts as a choice.
    searchStore.getState().patchTerm({ semester: '1' });
    await controlled.answer(ok(capture));
    expect(formTerm()).toEqual(fallback);
  });

  it('keeps the term of a search that ran before the answer', async () => {
    const controlled = controlledSend();
    const deps = { send: controlled.send, repo: repoReturning(null) };
    render(<InitProbe deps={deps} />);
    await waitFor(() => {
      expect(controlled.requested()).toBe(true);
    });
    const { result } = renderHook(() => useSearchActions(deps));
    act(() => {
      searchStore.getState().setActiveTab('by_subject_id');
      searchStore.getState().patchSubjectIdForm({ subjectId: '90592033' });
    });
    await act(() => result.current.submit());
    await controlled.answer(ok(capture));
    // The form and the summary bar keep naming the term the search ran under.
    expect(formTerm()).toEqual(fallback);
    const { barQuery } = searchStore.getState();
    expect(barQuery?.selected_year).toBe(fallback.year);
    expect(barQuery?.selected_semester).toBe(fallback.semester);
    act(() => {
      searchStore.getState().cancelSearch();
    });
  });

  it('keeps the fallback when the registrar request fails', async () => {
    const controlled = controlledSend();
    render(
      <InitProbe deps={{ send: controlled.send, repo: repoReturning(null) }} />,
    );
    await waitFor(() => {
      expect(controlled.requested()).toBe(true);
    });
    await controlled.answer(err(networkError('offline')));
    expect(formTerm()).toEqual(fallback);
  });

  it('seeds the active plan term without asking the registrar', async () => {
    const planTerm: Term = { year: '2568', semester: '3' };
    planStore.getState().createPlan('plan', planTerm);
    const controlled = controlledSend();
    render(
      <InitProbe deps={{ send: controlled.send, repo: repoReturning(null) }} />,
    );
    await waitFor(() => {
      expect(formTerm()).toEqual(planTerm);
    });
    expect(controlled.requested()).toBe(false);
  });

  it('leaves a route prefill alone when it mounts afterwards', async () => {
    const controlled = controlledSend();
    const repo = repoReturning(persistedState());
    await searchStore.getState().applyRoutePrefill(
      {
        tab: 'by_subject_owner_id',
        term: { year: '2568', semester: '3' },
        form: { faculty: '01', subjectOwner: '46' },
      },
      repo,
    );
    render(<InitProbe deps={{ send: controlled.send, repo }} />);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(searchStore.getState().activeTab).toBe('by_subject_owner_id');
    expect(formTerm()).toEqual({ year: '2568', semester: '3' });
    expect(controlled.requested()).toBe(false);
  });

  it('lands a prefill that arrives during the load over the hydrated search', async () => {
    const controlled = controlledSend();
    let release: (state: SearchState) => void = () => undefined;
    const repo: SearchStateRepository = {
      load: () =>
        new Promise<SearchState>((resolve) => {
          release = resolve;
        }),
      save: () => Promise.resolve(),
    };
    render(<InitProbe deps={{ send: controlled.send, repo }} />);
    const prefilled = searchStore.getState().applyRoutePrefill(
      {
        tab: 'by_subject_owner_id',
        term: { year: '2568', semester: '3' },
        form: { faculty: '01', subjectOwner: '46' },
      },
      repo,
    );
    release({ ...persistedState(), bySubjectId: { subjectId: '90592033' } });
    await prefilled;
    const state = searchStore.getState();
    expect(state.activeTab).toBe('by_subject_owner_id');
    expect(formTerm()).toEqual({ year: '2568', semester: '3' });
    expect(state.byCategory).toEqual({ faculty: '01', subjectOwner: '46' });
    expect(state.bySubjectId).toEqual({ subjectId: '90592033' });
    expect(controlled.requested()).toBe(false);
  });
});

// A send that never answers a query, so the store can be read while the query is
// still in flight. The cast is required because a single arrow cannot satisfy the
// generic send signature.
function pendingSend(): TypedSend {
  const handler = (message: RequestMessage) =>
    message.type === 'teachTable/query'
      ? new Promise<never>(() => undefined)
      : Promise.resolve(ok(null));
  return handler as unknown as TypedSend;
}

describe('useSearchActions', () => {
  afterEach(() => {
    act(() => {
      searchStore.getState().cancelSearch();
    });
  });

  it('folds the form before the first await of a submit', () => {
    act(() => {
      searchStore.getState().setActiveTab('by_subject_id');
      searchStore.getState().patchSubjectIdForm({ subjectId: '90592033' });
    });
    const { result } = renderHook(() =>
      useSearchActions({ send: pendingSend(), repo: repoReturning(null) }),
    );
    // The submit is not awaited: the write must already be visible when it returns
    // its promise, because the focus move to the bar runs in the same call.
    void result.current.submit();
    const state = searchStore.getState();
    expect(state.result.status).toBe('loading');
    expect(state.barQuery).not.toBeNull();
    expect(state.barQuery).toBe(state.resultQuery);
    expect(state.searchFormOpen).toBe(false);
  });

  it('retries in the background and leaves a reopened form open', () => {
    act(() => {
      searchStore.getState().setActiveTab('by_subject_id');
      searchStore.getState().patchSubjectIdForm({ subjectId: '90592033' });
    });
    const { result } = renderHook(() =>
      useSearchActions({ send: pendingSend(), repo: repoReturning(null) }),
    );
    void result.current.submit();
    const { barQuery, lastSubmitAt } = searchStore.getState();
    searchStore.getState().setSearchFormOpen(true);
    void result.current.retry();
    const state = searchStore.getState();
    expect(state.searchFormOpen).toBe(true);
    expect(state.barQuery).toBe(barQuery);
    expect(state.lastSubmitAt).toBe(lastSubmitAt);
  });

  it('clears the bar and opens the form on cancel', async () => {
    act(() => {
      searchStore.getState().setActiveTab('by_subject_id');
      searchStore.getState().patchSubjectIdForm({ subjectId: '90592033' });
    });
    const { result } = renderHook(() =>
      useSearchActions({ send: pendingSend(), repo: repoReturning(null) }),
    );
    void result.current.submit();
    await result.current.cancel();
    const state = searchStore.getState();
    expect(state.result).toEqual({ status: 'idle' });
    expect(state.barQuery).toBeNull();
    expect(state.searchFormOpen).toBe(true);
  });
});
