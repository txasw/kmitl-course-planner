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
import { searchStore } from './searchStore';
import { useSearchInit } from './useSearchController';

const term = { year: '2569', semester: '1' } as const;

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

function InitProbe({ repo }: { repo: SearchStateRepository }) {
  useSearchInit(repo, null);
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
});

afterEach(cleanup);

describe('useSearchInit', () => {
  it('hydrates the persisted search once', async () => {
    render(<InitProbe repo={repoReturning(persistedState())} />);
    await waitFor(() => {
      expect(searchStore.getState().activeTab).toBe('by_subject_id');
    });
    expect(searchStore.getState().hasInitialized).toBe(true);
  });

  it('does not re-hydrate on a remount, preserving in session edits', async () => {
    const repo = repoReturning(persistedState());
    const first = render(<InitProbe repo={repo} />);
    await waitFor(() => {
      expect(searchStore.getState().activeTab).toBe('by_subject_id');
    });
    // An in session edit after the first initialization.
    searchStore.getState().setActiveTab('by_class');
    first.unmount();
    // Reopening the overlay remounts the form; init must not run again.
    render(<InitProbe repo={repo} />);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(searchStore.getState().activeTab).toBe('by_class');
  });
});
