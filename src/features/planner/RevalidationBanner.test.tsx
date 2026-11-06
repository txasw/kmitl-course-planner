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
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { uiStore } from '@/features/shell/uiStore';
import { RevalidationBanner } from './RevalidationBanner';

function renderBanner(deps: SearchDeps = fakeSearchDeps()) {
  return render(
    <SearchDepsProvider value={deps}>
      <RevalidationBanner />
    </SearchDepsProvider>,
  );
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {}, updatesOpen: false });
  uiStore.getState().setViewMode('edit');
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

  it('opens the updates dialog from details, switching to edit first', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'missing' })], {
        id: 'p1',
      });
      revalidationStore.getState().setRun('p1', {
        status: 'done',
        report: {
          summary: { total: 1, unchanged: 0, changed: 0, missing: 1 },
          entries: [],
          termFindings: [],
        },
      });
      uiStore.getState().setViewMode('preview');
    });
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /รายละเอียด/ }));
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(revalidationStore.getState().updatesOpen).toBe(true);
    // The planner panel renders the dialog, outside the banner's live summary.
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
