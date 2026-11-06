import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { EntryDiff, ReconcileReport } from '@/lib/planner/revalidate';
import {
  makeMeeting,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { RevalidationDetailSheet } from './RevalidationDetailSheet';

const t = createTranslator('en');

const CHANGED: EntryDiff = {
  teachTableId: 't1',
  subjectId: '90000001',
  section: '901',
  outcome: 'changed',
  changes: ['room_changed'],
  before: makeSnapshot({
    meetings: [makeMeeting({ room: 'A101', building: '' })],
  }),
  after: makeSnapshot({
    meetings: [makeMeeting({ room: 'B202', building: '' })],
  }),
};

const MISSING: EntryDiff = {
  teachTableId: 't2',
  subjectId: '90000002',
  section: '902',
  outcome: 'missing',
  changes: [],
  before: makeSnapshot({ teachTableId: 't2', subjectId: '90000002' }),
  after: null,
};

const UNCHANGED: EntryDiff = {
  teachTableId: 't3',
  subjectId: '90000003',
  section: '903',
  outcome: 'unchanged',
  changes: [],
  before: makeSnapshot({ teachTableId: 't3', subjectId: '90000003' }),
  after: makeSnapshot({ teachTableId: 't3', subjectId: '90000003' }),
};

// The sheet portals into the overlay root, which the panel provides.
function renderSheet(onClose: () => void = vi.fn()) {
  return render(
    <PanelPortalContext.Provider value={document.body}>
      <RevalidationDetailSheet locale="en" t={t} onClose={onClose} />
    </PanelPortalContext.Provider>,
  );
}

function seedRun(entries: EntryDiff[]): void {
  const report: ReconcileReport = {
    summary: { total: entries.length, unchanged: 0, changed: 1, missing: 1 },
    entries,
    termFindings: [],
  };
  seedActivePlan([], { id: 'plan-1' });
  revalidationStore.getState().setRun('plan-1', { status: 'done', report });
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {} });
});

describe('RevalidationDetailSheet', () => {
  it('lists changed and missing entries with old versus new values', () => {
    act(() => {
      seedRun([CHANGED, MISSING, UNCHANGED]);
    });
    renderSheet();
    expect(screen.getByText('A101')).toBeInTheDocument();
    expect(screen.getByText('B202')).toBeInTheDocument();
    expect(screen.getByText(t('verify.missing'))).toBeInTheDocument();
  });

  it('omits an unchanged entry', () => {
    act(() => {
      seedRun([CHANGED, UNCHANGED]);
    });
    renderSheet();
    expect(screen.queryByText(/90000003/)).not.toBeInTheDocument();
  });

  it('starts focus on its heading and keeps Tab inside', () => {
    act(() => {
      seedRun([CHANGED]);
    });
    renderSheet();
    const dialog = screen.getByRole('dialog', {
      name: t('revalidation.detailTitle'),
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('heading', { name: t('revalidation.detailTitle') }),
    ).toHaveFocus();
    const close = screen.getByRole('button', { name: t('action.close') });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('closes through the close control', () => {
    act(() => {
      seedRun([CHANGED]);
    });
    const onClose = vi.fn();
    renderSheet(onClose);
    fireEvent.click(screen.getByRole('button', { name: t('action.close') }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape without bubbling to the overlay', () => {
    act(() => {
      seedRun([CHANGED]);
    });
    const onClose = vi.fn();
    renderSheet(onClose);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when there is no run', () => {
    act(() => {
      resetPlanStore();
    });
    renderSheet();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
