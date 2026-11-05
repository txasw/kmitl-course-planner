import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { searchStore } from '@/features/search/searchStore';
import { INPUT_GUARD_MS, InputGuard } from './InputGuard';

const ownerQuery: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  selected_subject_owner_id: '32',
};

const rendered = vi.fn();

// Stands in for the course catalog, recording its renders so a guard toggle that
// re-rendered the results would show.
function CountingCatalog() {
  rendered();
  return <button type="button">เพิ่ม</button>;
}

function guard(): HTMLElement {
  const node = screen.getByRole('button', { name: 'เพิ่ม' }).parentElement;
  if (node === null) throw new Error('the guard is not rendered');
  return node;
}

beforeEach(() => {
  vi.useFakeTimers();
  rendered.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => {
    searchStore.getState().cancelSearch();
  });
});

describe('InputGuard', () => {
  it('ignores pointer input for half a second after a submit', () => {
    render(
      <InputGuard>
        <CountingCatalog />
      </InputGuard>,
    );
    expect(guard()).not.toHaveClass('pointer-events-none');

    act(() => {
      searchStore.getState().startQuery(ownerQuery, 'user');
    });
    expect(guard()).toHaveClass('pointer-events-none');
    expect(guard()).toHaveAttribute('data-input-guard', 'on');

    act(() => {
      vi.advanceTimersByTime(INPUT_GUARD_MS - 1);
    });
    expect(guard()).toHaveClass('pointer-events-none');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(guard()).not.toHaveClass('pointer-events-none');
    expect(guard()).toHaveAttribute('data-input-guard', 'off');
  });

  it('never re-renders the results when the guard toggles', () => {
    render(
      <InputGuard>
        <CountingCatalog />
      </InputGuard>,
    );
    const before = rendered.mock.calls.length;
    act(() => {
      searchStore.getState().startQuery(ownerQuery, 'user');
    });
    act(() => {
      vi.advanceTimersByTime(INPUT_GUARD_MS);
    });
    expect(guard()).not.toHaveClass('pointer-events-none');
    expect(rendered).toHaveBeenCalledTimes(before);
  });

  it('restarts the window for each new submit and ignores background runs', () => {
    render(
      <InputGuard>
        <CountingCatalog />
      </InputGuard>,
    );
    act(() => {
      searchStore.getState().startQuery(ownerQuery, 'user');
    });
    act(() => {
      vi.advanceTimersByTime(INPUT_GUARD_MS);
    });
    act(() => {
      searchStore.getState().startQuery({ ...ownerQuery }, 'background');
    });
    expect(guard()).not.toHaveClass('pointer-events-none');

    act(() => {
      vi.advanceTimersByTime(1);
      searchStore.getState().startQuery({ ...ownerQuery }, 'user');
    });
    expect(guard()).toHaveClass('pointer-events-none');
  });

  it('does not guard a submit made before it mounted', () => {
    act(() => {
      searchStore.getState().startQuery(ownerQuery, 'user');
    });
    render(
      <InputGuard>
        <CountingCatalog />
      </InputGuard>,
    );
    expect(guard()).not.toHaveClass('pointer-events-none');
  });
});
