import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import {
  SearchDepsProvider,
  type SearchDeps,
} from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { revalidationStore } from '@/features/plans/revalidationStore';
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
  revalidationStore.setState({ runs: {} });
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
});
