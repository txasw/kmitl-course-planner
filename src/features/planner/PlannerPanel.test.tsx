import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { planStore } from '@/features/plans/planStore';
import { uiStore } from '@/features/shell/uiStore';
import type { PlanEntry } from '@/lib/domain/plan';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { PlannerPanel } from './PlannerPanel';

// The panel always renders inside the search deps provider in the app; the banner
// reads it for the manual refresh send.
function renderPanel() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <PlannerPanel />
    </SearchDepsProvider>,
  );
}

function seed(entries: PlanEntry[]): void {
  act(() => {
    planStore.setState({ entries });
  });
}

afterEach(() => {
  cleanup();
  seed([]);
  act(() => {
    uiStore.getState().setViewMode('edit');
  });
});

describe('PlannerPanel', () => {
  it('shows the designed empty state when the plan has no sections', () => {
    renderPanel();
    expect(screen.getByText('ตารางยังว่าง')).toBeInTheDocument();
  });

  it('renders a scheduled block, the unscheduled shelf, and the grid', () => {
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 'o1',
          subjectId: '90000002',
          section: '1',
          meetings: [],
        }),
      }),
    ]);
    renderPanel();
    expect(screen.getByLabelText(/90000001/)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'รายวิชาที่ไม่มีคาบเรียน' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('ตารางยังว่าง')).not.toBeInTheDocument();
  });

  it('opens a block detail popover in edit mode and clears it in preview', () => {
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
    ]);
    renderPanel();
    // The block itself opens the pinned popover on click; there is no info affordance.
    fireEvent.click(screen.getByRole('button', { name: /90000001/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the poster header in preview mode', () => {
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    renderPanel();
    expect(screen.getByRole('heading', { name: 'ตาราง' })).toBeInTheDocument();
  });

  it('has no serious accessibility violations when populated', async () => {
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 'o1',
          subjectId: '90000002',
          section: '1',
          meetings: [],
        }),
      }),
    ]);
    const { container } = renderPanel();
    await expectNoSeriousA11yViolations(container);
  });
});
