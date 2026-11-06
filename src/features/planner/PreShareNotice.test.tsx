import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  within,
} from '@testing-library/react';
import type { PlanEntry } from '@/lib/domain/plan';
import type { ReconcileReport } from '@/lib/planner/reconcile';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { uiStore } from '@/features/shell/uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { PlannerPanel } from './PlannerPanel';
import { PreShareNotice } from './PreShareNotice';

const NOTICE = 'มี 2 รายการที่ข้อมูลเปลี่ยนหรือไม่พบในระบบ ตรวจก่อนแชร์';

function entry(
  teachTableId: string,
  verifyStatus: PlanEntry['verifyStatus'],
): PlanEntry {
  return makePlanEntry({
    teachTableId,
    verifyStatus,
    snapshot: makeSnapshot({
      teachTableId,
      subjectId: `9000000${teachTableId.slice(-1)}`,
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    }),
  });
}

const changedPlan = [
  entry('t1', 'changed'),
  entry('t2', 'missing'),
  entry('t3', 'verified'),
];

const report: ReconcileReport = {
  summary: { total: 3, unchanged: 1, changed: 1, missing: 1 },
  entries: [
    {
      teachTableId: 't2',
      subjectId: '90000002',
      section: '901',
      outcome: 'missing',
      changes: [],
      before: makeSnapshot({ teachTableId: 't2' }),
      after: null,
    },
  ],
  termFindings: [],
};

function seed(entries: PlanEntry[], withReport: boolean): void {
  act(() => {
    seedActivePlan(entries, { id: 'p1' });
    revalidationStore
      .getState()
      .setRun(
        'p1',
        withReport
          ? { status: 'done', report }
          : { status: 'offline', report: null },
      );
    uiStore.getState().setViewMode('preview');
  });
}

function renderPanel() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <PanelPortalContext.Provider value={document.body}>
        <PlannerPanel />
      </PanelPortalContext.Provider>
    </SearchDepsProvider>,
  );
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  act(() => {
    revalidationStore.setState({ runs: {}, sheetOpen: false });
    uiStore.getState().setViewMode('edit');
  });
});

describe('PreShareNotice', () => {
  it('renders nothing for a plan with no changed or missing entries', () => {
    seed([entry('t1', 'verified'), entry('t2', 'unverified')], true);
    const { container } = render(<PreShareNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states the count of changed and missing entries', () => {
    seed(changedPlan, true);
    render(<PreShareNotice />);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it('switches to edit and opens the detail sheet from its action', () => {
    seed(changedPlan, true);
    render(<PreShareNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'ดูรายการ' }));
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(revalidationStore.getState().sheetOpen).toBe(true);
  });

  it('switches to edit but leaves the sheet closed when the run has no report', () => {
    seed(changedPlan, false);
    render(<PreShareNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'ดูรายการ' }));
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(revalidationStore.getState().sheetOpen).toBe(false);
  });

  it('leaves the sheet closed when the latest run lists no change', () => {
    act(() => {
      seedActivePlan(changedPlan, { id: 'p1' });
      revalidationStore.getState().setRun('p1', {
        status: 'partial',
        report: {
          summary: { total: 1, unchanged: 1, changed: 0, missing: 0 },
          entries: [],
          termFindings: [],
        },
      });
      uiStore.getState().setViewMode('preview');
    });
    render(<PreShareNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'ดูรายการ' }));
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(revalidationStore.getState().sheetOpen).toBe(false);
  });

  it('keeps mutating controls out of the preview DOM and reviews in edit', () => {
    seed(changedPlan, true);
    renderPanel();
    // The notice sits outside the toolbar, and its only control is the review action.
    const row = screen.getByRole('button', { name: 'ดูรายการ' }).parentElement;
    expect(row).toHaveTextContent(NOTICE);
    expect(row?.querySelectorAll('button')).toHaveLength(1);
    expect(
      within(screen.getByRole('toolbar')).queryByText(NOTICE),
    ).not.toBeInTheDocument();
    // Preview carries no remove, acknowledge, or sheet before the user leaves it.
    expect(
      screen.queryByRole('button', { name: /นำออก/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /รับทราบ/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ดูรายการ' }));
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: /รายละเอียดการตรวจสอบ/ }),
    ).toBeInTheDocument();
  });
});
