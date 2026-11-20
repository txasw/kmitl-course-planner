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
import { isCurriculumCourse } from '@/lib/catalog/subjectGroup';
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

/** The slide the carousel shows, the one slide that is not inert. */
function shownSlide(): HTMLElement {
  const shown = document.querySelector<HTMLElement>(
    '[data-suggest-slide]:not([inert])',
  );
  if (shown === null) {
    throw new Error('no suggestion slide');
  }
  return shown;
}

/** The teach table ids placed on the grid of the first suggestion, sorted. */
function firstCardBlocks(): string[] {
  const first = document.querySelector('[data-suggest-slide="0"]');
  if (first === null) {
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
  it('opens as a dialog with up to three suggestions, one per slide', async () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'แนะนำตาราง' })).toBeVisible();
    expect(await findCards()).toHaveLength(3);
    expect(
      document.querySelectorAll('[data-suggest-slide]:not([inert])'),
    ).toHaveLength(1);
    expect(screen.getAllByText('16')).not.toHaveLength(0);
  });

  it('pages one slide at a time with a portrait grid on a 390 px phone', async () => {
    renderDialog(390);
    expect(screen.getByRole('dialog', { name: 'แนะนำตาราง' })).toBeVisible();
    await findCards();
    const dots = within(
      screen.getByRole('group', { name: 'ตัวเลือกตาราง' }),
    ).getAllByRole('button');
    expect(dots).toHaveLength(3);
    expect(
      within(shownSlide()).getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' })
        .style.gridTemplateColumns,
    ).toMatch(PORTRAIT);

    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกถัดไป' }));
    expect(within(shownSlide()).getByRole('heading')).toHaveTextContent(
      'ตัวเลือกที่ 2',
    );
    expect(screen.getByText('ตัวเลือก 2 จาก 3')).toHaveAttribute(
      'aria-live',
      'polite',
    );

    // A new preference ranks the suggestions again, so the carousel returns to the best.
    fireEvent.click(screen.getByRole('button', { name: 'เน้นบ่าย' }));
    expect(within(shownSlide()).getByRole('heading')).toHaveTextContent(
      'ตัวเลือกที่ 1',
    );
  });

  it.each([768, 1440])(
    'shows one slide with a landscape grid on one frame at %i px',
    async (width) => {
      renderDialog(width);
      await findCards();
      const columns = gridColumns();
      expect(columns).toHaveLength(3);
      expect(columns[0]).not.toMatch(PORTRAIT);
      // One shared frame, so every slide draws the same hours on the same columns.
      expect(new Set(columns).size).toBe(1);
      expect(
        screen.getByRole('group', { name: 'ตัวเลือก 1 จาก 3' }),
      ).toBeInTheDocument();
    },
  );

  it('offers no full size view', async () => {
    renderDialog(1440);
    await findCards();
    expect(screen.queryByRole('button', { name: /ขนาดเต็ม/ })).toBeNull();
  });

  it('returns to the best suggestion after a plan change runs the search again', async () => {
    renderDialog(1440);
    await findCards();
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกที่ 3' }));
    expect(within(shownSlide()).getByRole('heading')).toHaveTextContent(
      'ตัวเลือกที่ 3',
    );
    // A placed entry ranks every suggestion again, so the third slide would hold another
    // suggestion; the carousel returns to the first.
    act(() => {
      seedActivePlan(lockSections(courses, [['04186098', '2']]));
    });
    // The subject the plan gained joins the tick list ticked.
    const planned = await screen.findByRole('region', {
      name: 'อยู่ในตารางแล้ว',
    });
    expect(within(planned).getByRole('checkbox')).toBeChecked();
    expect(within(shownSlide()).getByRole('heading')).toHaveTextContent(
      'ตัวเลือกที่ 1',
    );
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
    const planned = screen.getByRole('region', { name: 'อยู่ในตารางแล้ว' });
    expect(
      within(planned).getByRole('checkbox', { name: /04186098/ }),
    ).toBeChecked();
    await findCards();
    const apply = within(shownSlide()).getByRole('button', {
      name: 'ใช้ตารางนี้',
    });
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

  it('lists the plan subjects ticked and names the reason once they are unticked', async () => {
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
    // Every curriculum subject is in the plan, so it lists them by name, ticked, and the
    // suggestions rearrange them.
    const planned = screen.getByRole('region', { name: 'อยู่ในตารางแล้ว' });
    const plannedBoxes = within(planned).getAllByRole('checkbox');
    expect(plannedBoxes).toHaveLength(6);
    for (const box of plannedBoxes) {
      expect(box).toBeChecked();
    }
    expect(
      screen.queryByRole('region', { name: 'วิชาในหลักสูตร กลุ่ม 2' }),
    ).toBeNull();
    expect(await findCards()).not.toHaveLength(0);

    fireEvent.click(
      within(planned).getByRole('button', { name: 'ยกเลิกการเลือกทั้งหมด' }),
    );
    expect(
      await screen.findByText('เลือกอย่างน้อยหนึ่งวิชาเพื่อดูตารางที่แนะนำ'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ใช้ตารางนี้' })).toBeNull();

    // The GenEd courses are still there to tick, collapsed until opened.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น 0 จาก 6',
      }),
    );
    const other = screen.getByRole('region', {
      name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น',
    });
    fireEvent.click(within(other).getByRole('button', { name: 'เลือกทั้งหมด' }));
    expect(await findCards()).not.toHaveLength(0);
  });

  it('offers the empty state one action that ticks every subject', async () => {
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
    const planned = screen.getByRole('region', { name: 'อยู่ในตารางแล้ว' });
    fireEvent.click(
      within(planned).getByRole('button', { name: 'ยกเลิกการเลือกทั้งหมด' }),
    );
    await screen.findByText('เลือกอย่างน้อยหนึ่งวิชาเพื่อดูตารางที่แนะนำ');
    fireEvent.click(screen.getByRole('button', { name: 'เลือกทุกวิชา' }));
    expect(await findCards()).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'เลือกทุกวิชา' })).toBeNull();
    for (const box of within(planned).getAllByRole('checkbox')) {
      expect(box).toBeChecked();
    }
  });

  it('ticks the curriculum subjects by default and searches the ticked set', async () => {
    renderDialog();
    await findCards();
    const curriculum = screen.getByRole('region', {
      name: 'วิชาในหลักสูตร กลุ่ม 2',
    });
    const boxes = within(curriculum).getAllByRole('checkbox');
    expect(boxes).toHaveLength(6);
    for (const box of boxes) {
      expect(box).toBeChecked();
    }
    expect(screen.getByText('เลือกไว้ 6 วิชา')).toBeInTheDocument();
    // The GenEd group starts collapsed and unticked.
    expect(
      screen.getByRole('button', {
        name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น 0 จาก 6',
        expanded: false,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(curriculum).getByRole('button', { name: 'ยกเลิกการเลือกทั้งหมด' }),
    );
    expect(
      await screen.findByText('เลือกอย่างน้อยหนึ่งวิชาเพื่อดูตารางที่แนะนำ'),
    ).toBeInTheDocument();
    expect(screen.getByText('เลือกไว้ 0 วิชา')).toBeInTheDocument();

    const [first] = boxes;
    if (first === undefined) throw new Error('no checkbox');
    fireEvent.click(first);
    expect(await findCards()).not.toHaveLength(0);
    // Only the one ticked subject is placed, so every block on the card is one of its
    // sections.
    const firstCourse = courses.find(isCurriculumCourse);
    const ids = new Set(firstCourse?.sections.map((s) => s.teachTableId));
    expect(firstCardBlocks().length).toBeGreaterThan(0);
    for (const id of firstCardBlocks()) {
      expect(ids.has(id)).toBe(true);
    }
    expect(
      within(curriculum).getByRole('button', { name: 'เลือกทั้งหมด' }),
    ).toBeInTheDocument();
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
