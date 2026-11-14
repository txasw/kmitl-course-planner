import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
  within,
} from '@testing-library/react';
import {
  makePlan,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { searchStore } from '@/features/search/searchStore';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { toastStore } from '@/features/shell/toastStore';
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
  // The dropdown is the form from 640 px up; the sheet below has its own suite.
  beforeEach(() => {
    installViewport(1366);
  });

  it('lists the plans grouped by term', () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    // The trigger also names the active plan's term, so read the group headings from
    // the menu alone.
    const menu = screen
      .getByRole('button', { name: 'สร้างตาราง' })
      .closest<HTMLElement>('.kcp-scroll');
    if (menu === null) {
      throw new Error('expected the plan menu');
    }
    expect(within(menu).getByText('ภาคการศึกษา 1/2569')).toBeInTheDocument();
    expect(within(menu).getByText('ภาคการศึกษา 2/2569')).toBeInTheDocument();
    // A string role name matches the full accessible name, so it targets the select
    // button ("A") and not the per-row action buttons ("Rename A" and the rest).
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });

  it('summarizes the credits and subjects of each plan row', () => {
    act(() => {
      planStore.getState().hydrate([
        makePlan({
          id: 'a',
          name: 'A',
          entries: [
            // A lecture and practice pair of one subject counts its credit once.
            makePlanEntry({ teachTableId: '1', section: '101' }),
            makePlanEntry({ teachTableId: '2', section: '102' }),
            makePlanEntry({
              teachTableId: '3',
              subjectId: '90592033',
              snapshot: makeSnapshot({
                teachTableId: '3',
                subjectId: '90592033',
                subjectMeta: {
                  subjectId: '90592033',
                  nameTh: 'วิชา',
                  nameEn: 'Subject',
                  credit: 2,
                  creditStr: '2(2-0-4)',
                },
              }),
            }),
          ],
        }),
        makePlan({ id: 'b', name: 'B', entries: [] }),
      ]);
    });
    render(<PlanSwitcher />);
    openMenu();
    // The name alone names the row button; the summary describes it.
    const rowA = screen.getByRole('button', { name: 'A' });
    expect(rowA).toHaveAccessibleDescription('5 หน่วยกิต 2 วิชา');
    expect(
      screen.getByRole('button', { name: 'B' }),
    ).toHaveAccessibleDescription('ยังไม่มีวิชา');
  });

  it('caps the menu height to the available space so a long list scrolls', async () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    const menu = screen
      .getByRole('button', { name: 'สร้างตาราง' })
      .closest<HTMLElement>('.kcp-scroll');
    if (menu === null) {
      throw new Error('expected the menu to carry the panel scroll class');
    }
    await waitFor(() => {
      expect(menu.style.maxHeight).toMatch(/^\d+px$/);
    });
    expect(menu).toHaveClass('overflow-y-auto');
  });

  it('switches the active plan and snaps the search term', () => {
    seedTwoPlans();
    // Activate the first semester plan, then switch to the second semester plan.
    act(() => {
      planStore.getState().setActivePlan('a');
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(planStore.getState().activePlanId).toBe('b');
    expect(searchStore.getState().term.semester).toBe('2');
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

  it('defaults a new plan to the shared term whichever tab is active', () => {
    act(() => {
      searchStore.getState().seedTerm({ year: '2569', semester: '1' });
      searchStore.getState().patchTerm({ semester: '3' });
      searchStore.getState().setActiveTab('by_subject_owner_id');
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'สร้างตาราง' }));
    expect(screen.getByRole('textbox')).toHaveValue('ตาราง 3/2569');
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    const plans = planStore.getState().plans;
    expect(plans[0]?.year).toBe('2569');
    expect(plans[0]?.semester).toBe('3');
  });

  it('creates a plan for a chosen term and snaps the search form to it', () => {
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'สร้างตาราง' }));
    const year = screen.getByRole('combobox', { name: 'ปีการศึกษา' });
    const semester = screen.getByRole('combobox', { name: 'ภาคการศึกษา' });
    expect(year).toHaveValue('2569');
    expect(semester).toHaveValue('1');
    fireEvent.change(year, { target: { value: '2568' } });
    fireEvent.change(semester, { target: { value: '2' } });
    // The default name follows the chosen term while it is untouched.
    expect(screen.getByRole('textbox')).toHaveValue('ตาราง 2/2568');
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    const plans = planStore.getState().plans;
    expect(plans[0]?.name).toBe('ตาราง 2/2568');
    expect(plans[0]?.year).toBe('2568');
    expect(plans[0]?.semester).toBe('2');
    expect(searchStore.getState().term).toEqual({
      year: '2568',
      semester: '2',
    });
  });

  it('keeps offering the shown year when the search term moves', () => {
    act(() => {
      searchStore.getState().seedTerm({ year: '2550', semester: '1' });
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'สร้างตาราง' }));
    act(() => {
      searchStore.getState().seedTerm({ year: '2569', semester: '1' });
    });
    expect(screen.getByRole('combobox', { name: 'ปีการศึกษา' })).toHaveValue(
      '2550',
    );
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    expect(planStore.getState().plans[0]?.year).toBe('2550');
  });

  it('keeps an edited name when the term changes', () => {
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'สร้างตาราง' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'ตารางหลัก' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'ภาคการศึกษา' }), {
      target: { value: '3' },
    });
    expect(screen.getByRole('textbox')).toHaveValue('ตารางหลัก');
  });

  it('offers no term choice when renaming', () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'เปลี่ยนชื่อ A' }));
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('draws the plan name field boundary with the form control token', () => {
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'สร้างตาราง' }));
    const field = screen.getByLabelText('ชื่อตาราง');
    expect(field).toHaveClass('border-border-strong');
    expect(field).not.toHaveClass('border-border');
  });

  it('shows a prominent create, icon only per-row actions, and text import and export', () => {
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
      planStore.getState().setActivePlan('a');
    });
    render(<PlanSwitcher />);
    openMenu();
    // Create is a prominent labelled button at the top of the menu.
    expect(
      screen.getByRole('button', { name: 'สร้างตาราง' }),
    ).toHaveTextContent('สร้างตาราง');
    // The per-row actions keep their accessible name from aria-label but drop the visible
    // text, so an icon only button renders no label text.
    expect(
      screen.getByRole('button', { name: 'เปลี่ยนชื่อ A' }).textContent,
    ).toBe('');
    // Import and export keep their visible text because file actions read better with words.
    expect(
      screen.getByRole('button', { name: 'นำเข้า JSON' }),
    ).toHaveTextContent('นำเข้า JSON');
    expect(
      screen.getByRole('button', { name: 'ส่งออก JSON' }),
    ).toHaveTextContent('ส่งออก JSON');
  });

  it('copies the registration list of the active plan and closes the menu', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    // Only the clipboard is replaced, since the menu's floating-ui reads the platform.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    act(() => {
      planStore.getState().hydrate([makePlan({ id: 'a', name: 'A' })]);
      planStore.getState().setActivePlan('a');
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(
      screen.getByRole('button', { name: 'คัดลอกรายการลงทะเบียน' }),
    );
    expect(writeText).toHaveBeenCalledWith(
      '90000001 วิชา (กลุ่มเรียน ทฤษฎี 901)',
    );
    expect(
      screen.queryByRole('button', { name: 'สร้างตาราง' }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(toastStore.getState().toast?.message).toBe(
        'คัดลอกรายการลงทะเบียนแล้ว',
      );
    });
  });

  it('offers no registration list copy for an empty plan', () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    expect(
      screen.queryByRole('button', { name: 'คัดลอกรายการลงทะเบียน' }),
    ).not.toBeInTheDocument();
  });

  it('shows the per-row actions unless the device hovers with a fine pointer', () => {
    seedTwoPlans();
    const { container } = render(<PlanSwitcher />);
    openMenu();
    const rows = container.querySelectorAll('[data-plan-row-actions]');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // No bare opacity-0: the fade applies only under the hover and fine pointer query,
      // so a touch screen shows the actions at rest.
      expect(row).not.toHaveClass('opacity-0');
      expect(row).toHaveClass(
        '[@media(hover:hover)_and_(pointer:fine)]:opacity-0',
      );
      expect(row).toHaveClass('group-hover/row:opacity-100');
      expect(row).toHaveClass('group-focus-within/row:opacity-100');
    }
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
    fireEvent.click(screen.getByRole('button', { name: 'เปลี่ยนชื่อ A' }));
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
    // The per-row delete opens the confirm; the confirm view offers the delete button.
    fireEvent.click(screen.getByRole('button', { name: 'ลบ A' }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบ' }));
    expect(planStore.getState().plans).toHaveLength(0);
  });

  it('states the section count and that a delete cannot be undone', () => {
    act(() => {
      planStore.getState().hydrate([
        makePlan({
          id: 'a',
          name: 'A',
          entries: [
            makePlanEntry({ teachTableId: '1', section: '101' }),
            makePlanEntry({ teachTableId: '2', section: '102' }),
          ],
        }),
        makePlan({ id: 'b', name: 'B', entries: [makePlanEntry()] }),
        makePlan({ id: 'c', name: 'C', entries: [] }),
      ]);
    });
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'ลบ A' }));
    expect(
      screen.getByText('ลบตาราง "A" ที่มี 2 กลุ่มเรียน การลบนี้ย้อนกลับไม่ได้'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบ B' }));
    expect(
      screen.getByText('ลบตาราง "B" ที่มี 1 กลุ่มเรียน การลบนี้ย้อนกลับไม่ได้'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบ C' }));
    expect(
      screen.getByText(
        'ลบตาราง "C" ซึ่งยังไม่มีกลุ่มเรียน การลบนี้ย้อนกลับไม่ได้',
      ),
    ).toBeInTheDocument();
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
    // The field path is kept and the reason is localized, not the library's English.
    expect(
      screen.getByText('semester: ค่าไม่อยู่ในตัวเลือกที่รองรับ'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Invalid option|expected one of/i)).toBeNull();
    expect(planStore.getState().plans).toHaveLength(0);
  });

  it('keeps the plan when the delete confirm is cancelled', () => {
    seedTwoPlans();
    render(<PlanSwitcher />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'ลบ A' }));
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(planStore.getState().plans).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'สร้างตาราง' }),
    ).toBeInTheDocument();
  });

  it('returns from the import error view to the plan list', async () => {
    const { container } = render(<PlanSwitcher />);
    openMenu();
    selectFile(fileInput(container), { id: 'x', name: 'x' });
    await waitFor(() => {
      expect(
        screen.getByText('นำเข้าไม่สำเร็จ ข้อมูลไม่ถูกต้อง'),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
    expect(
      screen.getByRole('button', { name: 'สร้างตาราง' }),
    ).toBeInTheDocument();
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

describe('PlanSwitcher below 640 px', () => {
  beforeEach(() => {
    installViewport(390);
  });

  function renderInPanel() {
    return render(
      <PanelPortalContext.Provider value={document.body}>
        <PlanSwitcher />
      </PanelPortalContext.Provider>,
    );
  }

  it('opens the plan menu as a modal bottom sheet with its heading focused', () => {
    seedTwoPlans();
    renderInPanel();
    const trigger = screen.getByRole('button', { name: 'เลือกตาราง' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    openMenu();
    const sheet = screen.getByRole('dialog', { name: 'เลือกตาราง' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toHaveClass('rounded-t-kcp-sheet');
    expect(screen.getByRole('heading', { name: 'เลือกตาราง' })).toHaveFocus();
    expect(
      within(sheet).getByRole('button', { name: 'สร้างตาราง' }),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('ภาคการศึกษา 2/2569')).toBeInTheDocument();
  });

  it('keeps the sheet open on a press inside it and switches the plan', () => {
    seedTwoPlans();
    renderInPanel();
    openMenu();
    const sheet = screen.getByRole('dialog', { name: 'เลือกตาราง' });
    fireEvent.pointerDown(within(sheet).getByText('ภาคการศึกษา 1/2569'));
    fireEvent.mouseDown(within(sheet).getByText('ภาคการศึกษา 1/2569'));
    expect(screen.getByRole('dialog', { name: 'เลือกตาราง' })).toBe(sheet);

    fireEvent.click(within(sheet).getByRole('button', { name: 'B' }));
    expect(planStore.getState().activePlanId).toBe('b');
    expect(screen.queryByRole('dialog', { name: 'เลือกตาราง' })).toBeNull();
    expect(screen.getByRole('button', { name: 'เลือกตาราง' })).toHaveFocus();
  });

  it('holds the name form inside the sheet', () => {
    renderInPanel();
    openMenu();
    const sheet = screen.getByRole('dialog', { name: 'เลือกตาราง' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'สร้างตาราง' }));
    const name = within(sheet).getByRole('textbox', { name: 'ชื่อตาราง' });
    fireEvent.change(name, { target: { value: 'ตารางหลัก' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'บันทึก' }));
    expect(planStore.getState().plans[0]?.name).toBe('ตารางหลัก');
    expect(screen.queryByRole('dialog', { name: 'เลือกตาราง' })).toBeNull();
  });

  it('closes on Escape without the press reaching the overlay', () => {
    seedTwoPlans();
    renderInPanel();
    openMenu();
    const outer = vi.fn();
    document.body.addEventListener('keydown', outer);
    fireEvent.keyDown(screen.getByRole('button', { name: 'สร้างตาราง' }), {
      key: 'Escape',
    });
    document.body.removeEventListener('keydown', outer);
    expect(screen.queryByRole('dialog', { name: 'เลือกตาราง' })).toBeNull();
    expect(outer).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'เลือกตาราง' })).toHaveFocus();
  });
});
