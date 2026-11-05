import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
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
import { useSearchInit } from './useSearchController';

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
    schemaVersion: 1,
    activeTab: 'by_subject_id',
    byClass: defaultClassForm(term),
    bySubjectId: defaultSubjectIdForm(term),
    byCategory: defaultCategoryForm(term),
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

function formTerms(): Term[] {
  const { byClass, bySubjectId, byCategory } = searchStore.getState();
  return [byClass, bySubjectId, byCategory].map((form) => ({
    year: form.year,
    semester: form.semester,
  }));
}

function InitProbe({ deps }: { deps: SearchDeps }) {
  useSearchInit(deps, null);
  return null;
}

beforeEach(() => {
  const state = searchStore.getState();
  state.hydrate({
    schemaVersion: 1,
    activeTab: 'by_class',
    byClass: defaultClassForm(term),
    bySubjectId: defaultSubjectIdForm(term),
    byCategory: defaultCategoryForm(term),
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
    expect(formTerms()).toEqual([term, term, term]);
  });

  it('renders the fallback, then applies the term after the current one', async () => {
    const controlled = controlledSend();
    render(
      <InitProbe deps={{ send: controlled.send, repo: repoReturning(null) }} />,
    );
    await waitFor(() => {
      expect(controlled.requested()).toBe(true);
    });
    expect(formTerms()).toEqual([fallback, fallback, fallback]);
    await controlled.answer(ok(capture));
    const next = { year: '2569', semester: '2' };
    expect(formTerms()).toEqual([next, next, next]);
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
    searchStore.getState().patchClassForm({ semester: '1' });
    await controlled.answer(ok(capture));
    expect(formTerms()).toEqual([fallback, fallback, fallback]);
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
    expect(formTerms()).toEqual([fallback, fallback, fallback]);
  });

  it('seeds the active plan term without asking the registrar', async () => {
    const planTerm: Term = { year: '2568', semester: '3' };
    planStore.getState().createPlan('plan', planTerm);
    const controlled = controlledSend();
    render(
      <InitProbe deps={{ send: controlled.send, repo: repoReturning(null) }} />,
    );
    await waitFor(() => {
      expect(formTerms()).toEqual([planTerm, planTerm, planTerm]);
    });
    expect(controlled.requested()).toBe(false);
  });
});
