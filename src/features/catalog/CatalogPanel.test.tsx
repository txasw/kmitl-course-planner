import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  renderHook,
} from '@testing-library/react';
import { httpError, ok } from '@/lib/utils/result';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { searchStore } from '@/features/search/searchStore';
import { toastStore } from '@/features/shell/toastStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { makeCourse } from '../../../tests/support/domain-builders';
import { CatalogPanel, useResultCourseCount } from './CatalogPanel';

function renderPanel() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <CatalogPanel />
    </SearchDepsProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    searchStore.getState().cancelSearch();
    toastStore.getState().dismiss();
  });
});

describe('CatalogPanel', () => {
  it('shows the initial prompt while idle', () => {
    renderPanel();
    expect(
      screen.getByRole('heading', { name: 'ยังไม่มีรายวิชา' }),
    ).toBeInTheDocument();
  });

  // Brief 8.2: an empty state carries an icon, one sentence, and one action.
  it('offers the idle prompt one action that opens the search', () => {
    // From 640 px up the action unfolds the form; below it, it switches to the pane.
    installViewport(1366);
    act(() => {
      searchStore.getState().setSearchFormOpen(false);
    });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'ไปที่การค้นหา' }));
    expect(searchStore.getState().searchFormOpen).toBe(true);
  });

  it('shows a loading status while the query runs', () => {
    act(() => {
      searchStore.getState().setResult({ status: 'loading' }, null);
    });
    renderPanel();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('offers a cancel after the slow threshold and returns to idle', () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      // A stub cannot satisfy the generic TypedSend signature, so cast it; the test
      // only exercises the cancel message, which resolves to a void Result.
      const send = ((message: { type: string }) => {
        calls.push(message.type);
        return Promise.resolve(ok(undefined));
      }) as unknown as TypedSend;
      const query: TeachTableQuery = {
        mode: 'by_subject_owner_id',
        selected_year: '2569',
        selected_semester: '1',
        search_all_faculty: true,
        selected_subject_owner_id: '32',
      };
      act(() => {
        searchStore.getState().setResult({ status: 'loading' }, query);
      });
      render(
        <SearchDepsProvider value={fakeSearchDeps({ send })}>
          <CatalogPanel />
        </SearchDepsProvider>,
      );
      expect(
        screen.queryByRole('button', { name: 'ยกเลิก' }),
      ).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(8_000);
      });
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
      });
      expect(calls).toContain('teachTable/cancel');
      expect(searchStore.getState().result.status).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('guards the results against pointer input just after a submit', () => {
    vi.useFakeTimers();
    try {
      renderPanel();
      const query: TeachTableQuery = {
        mode: 'by_subject_owner_id',
        selected_year: '2569',
        selected_semester: '1',
        search_all_faculty: true,
        selected_subject_owner_id: '32',
      };
      act(() => {
        searchStore.getState().startQuery(query, 'user');
      });
      const loading = screen.getByRole('status');
      expect(loading.parentElement).toHaveClass('pointer-events-none');
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(loading.parentElement).not.toHaveClass('pointer-events-none');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a typed error with a retry action', () => {
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'error', error: httpError(500, 'boom') }, null);
    });
    renderPanel();
    expect(
      screen.getByRole('heading', { name: 'โหลดรายวิชาไม่สำเร็จ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('เซิร์ฟเวอร์ตอบกลับผิดพลาด')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ลองอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('offers to edit the search instead of a retry for a 404', () => {
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'error', error: httpError(404, 'missing') }, null);
    });
    renderPanel();
    expect(
      screen.getByRole('button', { name: 'แก้ไขการค้นหา' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'ลองอีกครั้ง' }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty result with the search summary', () => {
    act(() => {
      searchStore.getState().setResult(
        {
          status: 'ready',
          data: {
            courses: [],
            duplicateCount: 0,
            multiMeetingCount: 0,
            warnings: [],
          },
        },
        {
          mode: 'by_subject_owner_id',
          selected_year: '2569',
          selected_semester: '1',
          selected_faculty: '01',
          search_all_faculty: false,
          selected_subject_owner_id: '32',
        },
      );
    });
    renderPanel();
    expect(
      screen.getByRole('heading', { name: 'ไม่พบรายวิชา' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ภาคการศึกษา 1/2569')).toBeInTheDocument();
    // The one way out of an empty result is to change the search.
    act(() => {
      searchStore.getState().setSearchFormOpen(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขการค้นหา' }));
    expect(searchStore.getState().searchFormOpen).toBe(true);
  });
});

describe('useResultCourseCount', () => {
  it('is null until a result settles', () => {
    const { result } = renderHook(() => useResultCourseCount());
    expect(result.current).toBeNull();
    act(() => {
      searchStore.getState().setResult({ status: 'loading' }, null);
    });
    expect(result.current).toBeNull();
  });

  it('counts the courses of a settled result', () => {
    const { result } = renderHook(() => useResultCourseCount());
    act(() => {
      searchStore.getState().setResult(
        {
          status: 'ready',
          data: {
            courses: [
              makeCourse({ subjectId: '90592008' }),
              makeCourse({ subjectId: '90592033' }),
            ],
            duplicateCount: 0,
            multiMeetingCount: 0,
            warnings: [],
          },
        },
        null,
      );
    });
    expect(result.current).toBe(2);
  });
});
