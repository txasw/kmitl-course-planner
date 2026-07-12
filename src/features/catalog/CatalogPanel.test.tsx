import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { httpError, ok } from '@/lib/utils/result';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { searchStore } from '@/features/search/searchStore';
import { toastStore } from '@/features/shell/toastStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { makeCourse } from '../../../tests/support/domain-builders';
import { CatalogPanel } from './CatalogPanel';

function renderPanel() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <CatalogPanel />
    </SearchDepsProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => {
    searchStore.getState().setResult({ status: 'idle' }, null);
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
  });

  it('toasts when a refresh returns unchanged data', async () => {
    const catalog: NormalizedCatalog = {
      courses: [makeCourse({ subjectId: '90592008' })],
      duplicateCount: 0,
      multiMeetingCount: 0,
      warnings: [],
    };
    const query: TeachTableQuery = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: false,
      selected_subject_owner_id: '32',
    };
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, query);
    });
    // The refresh replays the query and gets the same catalog back.
    const send = ((message: { type: string }) =>
      message.type === 'teachTable/query'
        ? Promise.resolve(ok(catalog))
        : new Promise(() => undefined)) as unknown as TypedSend;
    render(
      <SearchDepsProvider value={fakeSearchDeps({ send })}>
        <CatalogPanel />
      </SearchDepsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรช' }));
    await waitFor(() => {
      expect(toastStore.getState().toast?.message).toBe(
        'ข้อมูลเป็นปัจจุบัน ไม่มีการเปลี่ยนแปลง',
      );
    });
  });
});
