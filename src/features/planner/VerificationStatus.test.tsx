import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import {
  SearchDepsProvider,
  type SearchDeps,
} from '@/features/search/SearchDepsContext';
import type { VerifyStatus } from '@/lib/domain/plan';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import {
  revalidationStore,
  type RevalidationRun,
} from '@/features/plans/revalidationStore';
import { uiStore } from '@/features/shell/uiStore';
import { VerificationStatus } from './VerificationStatus';

function renderStatus(deps: SearchDeps = fakeSearchDeps()) {
  return render(
    <SearchDepsProvider value={deps}>
      <VerificationStatus />
    </SearchDepsProvider>,
  );
}

const CHECKED = new Date(2026, 10, 6, 14, 32);

function seed(
  run: RevalidationRun | null,
  verifyStatus: VerifyStatus = 'verified',
) {
  act(() => {
    seedActivePlan(
      [
        makePlanEntry({
          verifyStatus,
          lastVerifiedAt: CHECKED.toISOString(),
        }),
      ],
      { id: 'p1' },
    );
    if (run !== null) {
      revalidationStore.getState().setRun('p1', run);
    }
  });
}

const clean: RevalidationRun = {
  status: 'done',
  report: {
    summary: { total: 1, unchanged: 1, changed: 0, missing: 0 },
    entries: [],
    termFindings: [],
  },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetPlanStore();
  revalidationStore.setState({ runs: {}, updatesOpen: false });
  uiStore.getState().setViewMode('edit');
});

describe('VerificationStatus', () => {
  it('renders nothing for an empty plan', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
    });
    const { container } = renderStatus();
    expect(container).toBeEmptyDOMElement();
  });

  it('states the checked time quietly with an icon button to check again', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 6, 15, 0), toFake: ['Date'] });
    seed(clean);
    const { container } = renderStatus();
    expect(screen.getByText('ตรวจสอบแล้ว 14:32')).toBeInTheDocument();
    expect(container.querySelector('[data-verification]')).toHaveAttribute(
      'data-verification',
      'ok',
    );
    const check = screen.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' });
    expect(check).toBeEnabled();
    expect(check).toHaveTextContent('');
  });

  it('is not a live region of its own', () => {
    seed(clean);
    const { container } = renderStatus();
    expect(container.querySelector('[aria-live], [role="status"]')).toBeNull();
  });

  it('runs a manual check that bypasses the cache', () => {
    // The check only sends teachTable/query and this test never settles it, so a
    // pending fake is enough; the cast is confined to this test seam.
    const send = vi.fn(() => new Promise(() => undefined));
    act(() => {
      seedActivePlan(
        [
          makePlanEntry({
            sourceQuery: {
              endpoint: 'get-teach-table-show',
              params: {
                mode: 'by_subject_id',
                selected_year: '2569',
                selected_semester: '1',
                search_all_faculty: 'true',
                search_all_department: 'true',
                search_all_curriculum: 'true',
                search_all_class_year: 'true',
                selected_subject_id: '90000001',
              },
            },
          }),
        ],
        { id: 'p1' },
      );
    });
    renderStatus(fakeSearchDeps({ send: send as unknown as TypedSend }));
    fireEvent.click(screen.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'teachTable/query', refresh: true }),
    );
    expect(revalidationStore.getState().runs.p1?.status).toBe('running');
  });

  it('disables the check while a check is running', () => {
    seed({ status: 'running', report: null });
    renderStatus();
    expect(screen.getByText('กำลังตรวจสอบข้อมูล')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }),
    ).toBeDisabled();
  });

  it('warns offline that it shows saved data and offers a retry', () => {
    seed({ status: 'offline', report: null });
    const { container } = renderStatus();
    expect(
      screen.getByText('ยังตรวจสอบไม่ได้ แสดงข้อมูลที่บันทึกไว้'),
    ).toHaveClass('text-warn');
    expect(container.querySelector('[data-verification]')).toHaveAttribute(
      'data-verification',
      'warn',
    );
    expect(
      screen.getByRole('button', { name: 'ลองอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('warns on a partial run and offers a retry', () => {
    seed({ ...clean, status: 'partial' });
    renderStatus();
    expect(screen.getByText(/บางรายการตรวจไม่ได้/)).toHaveClass('text-warn');
    expect(
      screen.getByRole('button', { name: 'ลองอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('opens the updates dialog from details, switching to edit first', () => {
    seed(
      {
        status: 'done',
        report: {
          summary: { total: 1, unchanged: 0, changed: 0, missing: 1 },
          entries: [],
          termFindings: [],
        },
      },
      'missing',
    );
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    renderStatus();
    expect(screen.getByText(/ไม่พบ 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /รายละเอียด/ }));
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });

  it('offers no details when nothing is left to review', () => {
    seed(clean);
    renderStatus();
    expect(
      screen.queryByRole('button', { name: /รายละเอียด/ }),
    ).not.toBeInTheDocument();
  });
});
