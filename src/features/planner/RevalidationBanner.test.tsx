import { describe, it, expect, afterEach } from 'vitest';
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
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { makeSnapshot } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { RevalidationBanner } from './RevalidationBanner';

// The detail sheet portals into the overlay root, which the panel provides.
function renderBanner(deps: SearchDeps = fakeSearchDeps()) {
  return render(
    <SearchDepsProvider value={deps}>
      <PanelPortalContext.Provider value={document.body}>
        <RevalidationBanner />
      </PanelPortalContext.Provider>
    </SearchDepsProvider>,
  );
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {}, sheetOpen: false });
});

describe('RevalidationBanner', () => {
  it('renders nothing without a run for the active plan', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
    });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the offline state with a retry', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
      revalidationStore
        .getState()
        .setRun('p1', { status: 'offline', report: null });
    });
    renderBanner();
    expect(screen.getByText(/ตรวจสอบไม่ได้/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ลองอีกครั้ง/ }),
    ).toBeInTheDocument();
  });

  it('shows the summary for a completed check', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
      revalidationStore.getState().setRun('p1', {
        status: 'done',
        report: {
          summary: { total: 3, unchanged: 2, changed: 1, missing: 0 },
          entries: [],
          termFindings: [],
        },
      });
    });
    renderBanner();
    expect(screen.getByText(/ตรวจสอบแล้ว 3/)).toBeInTheDocument();
    expect(screen.getByText(/เปลี่ยน 1/)).toBeInTheDocument();
  });

  it('opens the detail sheet from a run with changes', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
      revalidationStore.getState().setRun('p1', {
        status: 'done',
        report: {
          summary: { total: 1, unchanged: 0, changed: 1, missing: 0 },
          entries: [
            {
              teachTableId: 't1',
              subjectId: '90000001',
              section: '901',
              outcome: 'changed',
              changes: ['room_changed'],
              before: makeSnapshot(),
              after: makeSnapshot(),
            },
          ],
          termFindings: [],
        },
      });
    });
    renderBanner();
    const detail = screen.getByRole('button', { name: /รายละเอียด/ });
    detail.focus();
    fireEvent.click(detail);
    const dialog = screen.getByRole('dialog', {
      name: /รายละเอียดการตรวจสอบ/,
    });
    // The sheet sits outside the live summary, so its list is not read as a status.
    expect(dialog.closest('[aria-live]')).toBeNull();
    expect(screen.getByText('90000001 กลุ่มเรียน 901')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(detail).toHaveFocus();
  });

  it('renders the detail sheet when the store asks for it and closes it there', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
      revalidationStore.getState().setRun('p1', {
        status: 'done',
        report: {
          summary: { total: 1, unchanged: 0, changed: 0, missing: 1 },
          entries: [
            {
              teachTableId: 't1',
              subjectId: '90000001',
              section: '901',
              outcome: 'missing',
              changes: [],
              before: makeSnapshot(),
              after: null,
            },
          ],
          termFindings: [],
        },
      });
      revalidationStore.getState().setSheetOpen(true);
    });
    renderBanner();
    expect(
      screen.getByRole('dialog', { name: /รายละเอียดการตรวจสอบ/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(revalidationStore.getState().sheetOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers no detail button when everything matches', () => {
    act(() => {
      seedActivePlan([], { id: 'p1' });
      revalidationStore.getState().setRun('p1', {
        status: 'done',
        report: {
          summary: { total: 2, unchanged: 2, changed: 0, missing: 0 },
          entries: [],
          termFindings: [],
        },
      });
    });
    renderBanner();
    expect(
      screen.queryByRole('button', { name: /รายละเอียด/ }),
    ).not.toBeInTheDocument();
  });
});
