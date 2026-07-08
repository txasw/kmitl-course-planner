import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { planStore } from '@/features/plans/planStore';
import type { PlanEntry } from '@/lib/domain/plan';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { PlannerPanel } from './PlannerPanel';

function seed(entries: PlanEntry[]): void {
  act(() => {
    planStore.setState({ entries });
  });
}

afterEach(() => {
  cleanup();
  seed([]);
});

describe('PlannerPanel', () => {
  it('shows the designed empty state when the plan has no sections', () => {
    render(<PlannerPanel />);
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
    render(<PlannerPanel />);
    expect(screen.getByLabelText(/90000001/)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'รายวิชาที่ไม่มีคาบเรียน' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('ตารางยังว่าง')).not.toBeInTheDocument();
  });
});
