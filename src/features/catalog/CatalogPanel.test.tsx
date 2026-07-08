import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { httpError } from '@/lib/utils/result';
import { searchStore } from '@/features/search/searchStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
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
          data: { courses: [], duplicateCount: 0, warnings: [] },
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
});
