import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { PlanEntry } from '@/lib/domain/plan';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { planStore } from '@/features/plans/planStore';
import { uiStore } from '@/features/shell/uiStore';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import {
  byClassCourses,
  lockSections,
  SUGGEST_QUERY,
  SUGGEST_TERM,
} from '../../../tests/support/suggest';
import { installViewport } from '../../../tests/support/viewport';
import { SuggestDialog } from './SuggestDialog';

const courses = byClassCourses();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    resetPlanStore();
    uiStore.getState().setSuggestObjective('coverAll');
    uiStore.getState().setSuggestPreference('balanced');
  });
});

function renderDialog(width = 1366) {
  installViewport(width);
  const portal = document.createElement('div');
  document.body.append(portal);
  const onClose = vi.fn();
  render(
    <PanelPortalContext.Provider value={portal}>
      <SuggestDialog
        courses={courses}
        sourceQuery={SUGGEST_QUERY}
        term={SUGGEST_TERM}
        onClose={onClose}
      />
    </PanelPortalContext.Provider>,
  );
  return { onClose, portal };
}

/** The teach table ids placed on the grid of the first card, in render order. */
function firstCardBlocks(): string[] {
  const [first] = screen.getAllByRole('listitem');
  if (first === undefined) {
    throw new Error('no suggestion card');
  }
  return Array.from(
    first.querySelectorAll<HTMLElement>('[data-teach-table-id]'),
    (block) => block.dataset.teachTableId ?? '',
  ).sort();
}

// A portrait grid opens with its time axis column, then one column per day.
const PORTRAIT = /^2\.75rem repeat\(/;

/** The column template of every suggestion grid on screen, in card order. */
function gridColumns(): string[] {
  return screen
    .getAllByRole('group', { name: 'ตารางเรียนรายสัปดาห์' })
    .map((grid) => grid.style.gridTemplateColumns);
}

async function findCards(): Promise<HTMLElement[]> {
  return screen.findAllByRole('button', { name: 'ใช้ตารางนี้' });
}

describe('SuggestDialog', () => {
  it('opens as a dialog with up to three suggestions', async () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'แนะนำตาราง' })).toBeVisible();
    expect(await findCards()).toHaveLength(3);
    expect(screen.getAllByText('16')).not.toHaveLength(0);
  });

  it('pages one card at a time on a 390 px phone', async () => {
    renderDialog(390);
    expect(screen.getByRole('dialog', { name: 'แนะนำตาราง' })).toBeVisible();
    expect(await findCards()).toHaveLength(1);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    const dots = within(
      screen.getByRole('radiogroup', { name: 'ตัวเลือกตาราง' }),
    ).getAllByRole('radio');
    expect(dots).toHaveLength(3);
    expect(gridColumns()).toEqual([expect.stringMatching(PORTRAIT)]);

    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกถัดไป' }));
    expect(
      screen.getByRole('heading', { name: 'ตัวเลือกที่ 2' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ตัวเลือกที่ 2' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'ตัวเลือกที่ 2' }), {
      key: 'End',
    });
    expect(
      screen.getByRole('heading', { name: 'ตัวเลือกที่ 3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ตัวเลือกถัดไป' }),
    ).toBeDisabled();

    // A new preference ranks the cards again, so the pager returns to the best one.
    fireEvent.click(screen.getByRole('button', { name: 'เน้นบ่าย' }));
    expect(
      screen.getByRole('heading', { name: 'ตัวเลือกที่ 1' }),
    ).toBeInTheDocument();
  });

  it('sets the cards side by side with portrait grids at 768 px', async () => {
    renderDialog(768);
    expect(await findCards()).toHaveLength(3);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.queryByRole('radiogroup', { name: 'ตัวเลือกตาราง' }),
    ).toBeNull();
    const columns = gridColumns();
    expect(columns).toHaveLength(3);
    for (const column of columns) {
      expect(column).toMatch(PORTRAIT);
    }
  });

  it('compares the cards side by side on one frame at 1440 px', async () => {
    renderDialog(1440);
    expect(await findCards()).toHaveLength(3);
    const list = screen.getAllByRole('listitem')[0]?.parentElement;
    expect(list?.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    const columns = gridColumns();
    expect(columns).toHaveLength(3);
    expect(columns[0]).not.toMatch(PORTRAIT);
    // One shared frame, so every card draws the same hours on the same columns.
    expect(new Set(columns).size).toBe(1);
    for (const card of screen.getAllByRole('article')) {
      expect(within(card).getByText('เริ่มเร็วสุด')).toBeInTheDocument();
    }
  });

  it('opens a card full size and returns focus to it', async () => {
    renderDialog(1440);
    await findCards();
    const [, second] = screen.getAllByRole('button', { name: 'ดูขนาดเต็ม' });
    if (second === undefined) throw new Error('no second card');
    fireEvent.click(second);

    expect(
      screen.getByRole('heading', { name: 'ตัวเลือกที่ 2' }),
    ).toHaveFocus();
    expect(screen.getAllByRole('button', { name: 'ใช้ตารางนี้' })).toHaveLength(
      1,
    );
    expect(screen.queryByRole('button', { name: 'สมดุล' })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'กลับไปที่ตัวเลือกทั้งหมด' }),
    );
    expect(await findCards()).toHaveLength(3);
    expect(
      screen.getAllByRole('button', { name: 'ดูขนาดเต็ม' })[1],
    ).toHaveFocus();
  });

  it('reorders the cards when the preference changes', async () => {
    renderDialog();
    await findCards();
    const balanced = firstCardBlocks();
    fireEvent.click(screen.getByRole('button', { name: 'เน้นบ่าย' }));
    await waitFor(() => {
      expect(firstCardBlocks()).not.toEqual(balanced);
    });
    expect(
      screen.getByRole('button', { name: 'เน้นบ่าย', pressed: true }),
    ).toBeInTheDocument();
  });

  it('applies a card as a new plan that keeps the placed entries', async () => {
    const locked = lockSections(courses, [['04186098', '2']]);
    act(() => {
      seedActivePlan(locked, { id: 'original', name: 'ตาราง 1/2569' });
    });
    const original = planStore.getState().plans[0];
    const { onClose } = renderDialog();
    expect(
      screen.getByText('คงรายวิชาที่อยู่ในตารางปัจจุบันไว้ 1 วิชา'),
    ).toBeInTheDocument();
    const [apply] = await findCards();
    if (apply === undefined) throw new Error('no apply button');
    act(() => {
      fireEvent.click(apply);
    });

    const state = planStore.getState();
    expect(onClose).toHaveBeenCalledOnce();
    expect(state.plans).toHaveLength(2);
    expect(state.plans[0]).toBe(original);
    const created = state.plans.find((plan) => plan.id === state.activePlanId);
    expect(created?.name).toBe('ตาราง 1/2569 สมดุล');
    const subjects = new Set(
      created?.entries.map((entry: PlanEntry) => entry.subjectId),
    );
    expect(subjects.has('04186098')).toBe(true);
    expect(subjects.size).toBeGreaterThan(1);

    act(() => {
      planStore.getState().undo();
    });
    expect(planStore.getState().plans).toEqual([original]);
    expect(planStore.getState().activePlanId).toBe('original');
  });

  it('names the reason when there is nothing to suggest', async () => {
    const locked = lockSections(courses, [
      ['01006020', '4'],
      ['01006021', '5'],
      ['01006030', '33'],
      ['01006503', '1'],
      ['01476012', '33'],
      ['01476101', '33'],
    ]);
    act(() => {
      seedActivePlan(locked);
    });
    renderDialog();
    expect(
      await screen.findByText(
        'วิชาในหลักสูตรทุกวิชาของผลการค้นหานี้อยู่ในตารางแล้ว',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ใช้ตารางนี้' })).toBeNull();
  });

  it.each([390, 1366])(
    'has no serious accessibility violations when open at %i px',
    async (width) => {
      const { portal } = renderDialog(width);
      await findCards();
      const dialog = within(portal).getByRole('dialog');
      await expectNoSeriousA11yViolations(dialog);
    },
  );

  it('opens on the options last used and remembers a new one', async () => {
    act(() => {
      uiStore.getState().setSuggestObjective('maxCredits');
      uiStore.getState().setSuggestPreference('fewerDays');
    });
    renderDialog();
    await findCards();
    expect(
      screen.getByRole('button', { name: 'เรียนน้อยวัน', pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'หน่วยกิตมากที่สุด', pressed: true }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เน้นเช้า' }));
    expect(uiStore.getState().suggestPreference).toBe('morning');
  });
});
