import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { makePlan } from '../../../tests/support/domain-builders';
import { searchStore } from '@/features/search/searchStore';
import { planStore } from './planStore';
import { PlanSwitcher } from './PlanSwitcher';

beforeEach(() => {
  act(() => {
    planStore.setState({
      plans: [],
      activePlanId: null,
      entries: [],
      pendingUndo: null,
    });
    searchStore.getState().setActiveTab('by_class');
    searchStore.getState().seedTerm({ year: '2569', semester: '1' });
  });
});

afterEach(cleanup);

function seedTwoPlans() {
  act(() => {
    planStore.getState().hydrate([
      makePlan({
        id: 'a',
        name: 'A',
        year: '2569',
        semester: '1',
        entries: [],
      }),
      makePlan({
        id: 'b',
        name: 'B',
        year: '2569',
        semester: '2',
        entries: [],
      }),
    ]);
  });
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'เลือกตาราง' }));
}

describe('PlanSwitcher', () => {
  it('lists the plans grouped by term', () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    expect(screen.getByText('ภาคการศึกษา 1/2569')).toBeInTheDocument();
    expect(screen.getByText('ภาคการศึกษา 2/2569')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /B/ })).toBeInTheDocument();
  });

  it('switches the active plan and snaps the search term', () => {
    seedTwoPlans();
    // Activate the first semester plan, then switch to the second semester plan.
    act(() => {
      planStore.getState().setActivePlan('a');
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /B/ }));
    expect(planStore.getState().activePlanId).toBe('b');
    expect(searchStore.getState().byClass.semester).toBe('2');
  });

  it('creates a plan for the current search term', () => {
    act(() => {
      searchStore.getState().seedTerm({ year: '2569', semester: '2' });
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'สร้างตาราง' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    const plans = planStore.getState().plans;
    expect(plans).toHaveLength(1);
    expect(plans[0]?.semester).toBe('2');
  });

  it('renames the active plan', () => {
    act(() => {
      planStore.getState().hydrate([
        makePlan({
          id: 'a',
          name: 'A',
          year: '2569',
          semester: '1',
          entries: [],
        }),
      ]);
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'เปลี่ยนชื่อ' }));
    const input = screen.getByLabelText('ชื่อตาราง');
    fireEvent.change(input, { target: { value: 'ตารางใหม่' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    expect(planStore.getState().plans[0]?.name).toBe('ตารางใหม่');
  });

  it('dismisses the dropdown on Escape', () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    expect(
      screen.getByRole('button', { name: 'สร้างตาราง' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'สร้างตาราง' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('button', { name: 'สร้างตาราง' })).toBeNull();
  });

  it('disables create until the search term has a year', () => {
    act(() => {
      searchStore.getState().seedTerm({ year: '', semester: '1' });
    });
    render(<PlanSwitcher />);
    openMenu();
    expect(screen.getByRole('button', { name: 'สร้างตาราง' })).toBeDisabled();
  });

  it('deletes the active plan behind a confirm', () => {
    act(() => {
      planStore.getState().hydrate([
        makePlan({
          id: 'a',
          name: 'A',
          year: '2569',
          semester: '1',
          entries: [],
        }),
      ]);
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'ลบ' }));
    // The confirm view offers a delete button; confirm the deletion.
    fireEvent.click(screen.getByRole('button', { name: 'ลบ' }));
    expect(planStore.getState().plans).toHaveLength(0);
  });
});
