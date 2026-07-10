import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { ReconcileReport } from '@/lib/planner/revalidate';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { BlockDetailPopover } from './BlockDetailPopover';

const t = createTranslator('en');

function makeAnchor(): HTMLElement {
  const anchor = document.createElement('div');
  anchor.dataset.teachTableId = 't1';
  document.body.appendChild(anchor);
  return anchor;
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {} });
  document.querySelectorAll('[data-teach-table-id]').forEach((node) => {
    node.remove();
  });
});

function renderPopover(
  overrides: {
    onClose?: () => void;
    onRemove?: (id: string) => void;
    examOverlaps?: ExamOverlap[];
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onRemove = overrides.onRemove ?? vi.fn();
  const anchor = makeAnchor();
  render(
    <BlockDetailPopover
      teachTableId="t1"
      anchor={anchor}
      locale="en"
      t={t}
      onClose={onClose}
      onRemove={onRemove}
      examOverlaps={overrides.examOverlaps ?? []}
    />,
  );
  return { onClose, onRemove };
}

describe('BlockDetailPopover', () => {
  it('renders the section metadata for the entry', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    renderPopover();
    expect(
      screen.getByText(
        (_, node) => node?.textContent === '90000001 Section 901',
      ),
    ).toBeInTheDocument();
  });

  it('removes through the callback and closes', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    const { onClose, onRemove } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('t1');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers acknowledge only for a changed entry and clears the status', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'changed' })]);
    });
    renderPopover();
    const acknowledge = screen.getByRole('button', { name: 'Acknowledge' });
    act(() => {
      fireEvent.click(acknowledge);
    });
    expect(planStore.getState().entries[0]?.verifyStatus).toBe('verified');
  });

  it('hides acknowledge for a verified entry', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    });
    renderPopover();
    expect(
      screen.queryByRole('button', { name: 'Acknowledge' }),
    ).not.toBeInTheDocument();
  });

  it('shows old versus new values from the active revalidation run', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'changed' })], {
        id: 'plan-1',
      });
      const report: ReconcileReport = {
        summary: { total: 1, unchanged: 0, changed: 1, missing: 0 },
        entries: [
          {
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
          },
        ],
        termFindings: [],
      };
      revalidationStore.getState().setRun('plan-1', {
        status: 'done',
        report,
      });
    });
    renderPopover();
    expect(screen.getByText('B202')).toBeInTheDocument();
    expect(screen.getByText('A101')).toBeInTheDocument();
  });

  it('lists an exam overlap with both windows, distinct from the diff', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    });
    renderPopover({
      examOverlaps: [
        {
          blocking: { teachTableId: 'x', subjectId: '90000009', section: '5' },
          kind: 'midterm',
          self: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
          other: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
        },
      ],
    });
    expect(screen.getByText('Exam overlap')).toBeInTheDocument();
    expect(screen.getByText('Midterm')).toBeInTheDocument();
    expect(screen.getByText('2026-08-21 09:00-12:00')).toBeInTheDocument();
    expect(
      screen.getByText(/90000009 Section 5: 2026-08-21 11:00-13:00/),
    ).toBeInTheDocument();
  });

  it('closes when the entry leaves the plan', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    const { onClose } = renderPopover();
    act(() => {
      planStore.setState({ entries: [] });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
