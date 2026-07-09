import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import { makePlan } from '../../../tests/support/domain-builders';
import { searchStore } from '@/features/search/searchStore';
import { planStore } from './planStore';
import { PlanSwitcher } from './PlanSwitcher';

const validBlob = {
  id: 'imported-id',
  name: 'Imported',
  year: '2569',
  semester: '1',
  entries: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('expected a file input');
  }
  return input;
}

function selectFile(input: HTMLInputElement, value: unknown): void {
  const file = new File([JSON.stringify(value)], 'plan.json', {
    type: 'application/json',
  });
  fireEvent.change(input, { target: { files: [file] } });
}

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

  it('lists the invalid fields of a tampered import and commits nothing', async () => {
    const { container } = render(<PlanSwitcher />);
    openMenu();
    // A valid shape with an out of range semester enum.
    selectFile(fileInput(container), { ...validBlob, semester: '9' });

    await waitFor(() => {
      expect(
        screen.getByText('นำเข้าไม่สำเร็จ ข้อมูลไม่ถูกต้อง'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/semester/)).toBeInTheDocument();
    expect(planStore.getState().plans).toHaveLength(0);
  });

  it('imports a valid plan as a new unverified plan', async () => {
    const { container } = render(<PlanSwitcher />);
    openMenu();
    selectFile(fileInput(container), validBlob);

    await waitFor(() => {
      expect(planStore.getState().plans).toHaveLength(1);
    });
    const plans = planStore.getState().plans;
    expect(plans[0]?.name).toBe('Imported');
    // A fresh id, never the imported one, so it cannot overwrite a plan.
    expect(plans[0]?.id).not.toBe('imported-id');
    expect(planStore.getState().activePlanId).toBe(plans[0]?.id);
  });
});
