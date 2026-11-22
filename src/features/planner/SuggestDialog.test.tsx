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
  const onApplied = vi.fn();
  render(
    <PanelPortalContext.Provider value={portal}>
      <SuggestDialog
        courses={courses}
        sourceQuery={SUGGEST_QUERY}
        term={SUGGEST_TERM}
        onClose={onClose}
        onApplied={onApplied}
      />
    </PanelPortalContext.Provider>,
  );
  return { onClose, onApplied, portal };
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

/** The group segment whose name starts with the label. */
function segment(label: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${label} เลือก`) });
}

/** Open a group's list from its segment. */
function openGroup(label: string): void {
  fireEvent.click(segment(label));
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
    openGroup('ในตาราง');
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
    const { onClose, onApplied } = renderDialog();
    openGroup('ในตาราง');
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
    // The opener shows the timetable, so applying hands back rather than closing.
    expect(onApplied).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
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

  it('lists the plan subjects ticked and says the plan already fits them', async () => {
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
    openGroup('ในตาราง');
    // Every curriculum subject is in the plan, so it lists them by name, ticked. No move
    // gains anything, so it offers no reshuffle and says the ticked subjects fit as they
    // are rather than asking for a tick the list already shows.
    const planned = screen.getByRole('region', { name: 'อยู่ในตารางแล้ว' });
    const plannedBoxes = within(planned).getAllByRole('checkbox');
    expect(plannedBoxes).toHaveLength(6);
    for (const box of plannedBoxes) {
      expect(box).toBeChecked();
    }
    expect(
      screen.queryByRole('region', { name: 'วิชาในหลักสูตร กลุ่ม 2' }),
    ).toBeNull();
    expect(
      await screen.findByText(
        'ตารางปัจจุบันลงวิชาที่เลือกไว้ได้ครบแล้ว เลือกวิชาอื่นเพิ่มเพื่อดูตารางที่แนะนำ',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('เลือกอย่างน้อยหนึ่งวิชาเพื่อดูตารางที่แนะนำ')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'เลือกทุกวิชา' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ใช้ตารางนี้' })).toBeNull();

    fireEvent.click(
      within(planned).getByRole('button', { name: 'ยกเลิกการเลือกทั้งหมด' }),
    );
    expect(
      await screen.findByText('เลือกอย่างน้อยหนึ่งวิชาเพื่อดูตารางที่แนะนำ'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ใช้ตารางนี้' })).toBeNull();

    // The GenEd courses are still there to tick, one segment away.
    expect(screen.queryByRole('button', { name: /^ในหลักสูตร/ })).toBeNull();
    openGroup('ศึกษาทั่วไปและอื่น ๆ');
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
    openGroup('ในตาราง');
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
    // The GenEd group opens by default, unticked, so a student sees those can join.
    expect(segment('ศึกษาทั่วไปและอื่น ๆ')).toHaveAttribute('aria-expanded', 'true');
    expect(segment('ศึกษาทั่วไปและอื่น ๆ')).toHaveAccessibleName(
      'ศึกษาทั่วไปและอื่น ๆ เลือก 0 จาก 6',
    );
    expect(
      screen.getByRole('region', {
        name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น',
      }),
    ).toBeVisible();
    // The curriculum subjects start ticked, their list collapsed behind the segment.
    expect(segment('ในหลักสูตร')).toHaveAttribute('aria-expanded', 'false');
    expect(segment('ในหลักสูตร')).toHaveAccessibleName('ในหลักสูตร เลือก 6 จาก 6');
    openGroup('ในหลักสูตร');
    // One group is open at a time.
    expect(
      screen.queryByRole('region', {
        name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น',
      }),
    ).toBeNull();
    const curriculum = screen.getByRole('region', {
      name: 'วิชาในหลักสูตร กลุ่ม 2',
    });
    const boxes = within(curriculum).getAllByRole('checkbox');
    expect(boxes).toHaveLength(6);
    for (const box of boxes) {
      expect(box).toBeChecked();
    }

    fireEvent.click(
      within(curriculum).getByRole('button', { name: 'ยกเลิกการเลือกทั้งหมด' }),
    );
    expect(
      await screen.findByText('เลือกอย่างน้อยหนึ่งวิชาเพื่อดูตารางที่แนะนำ'),
    ).toBeInTheDocument();
    expect(segment('ในหลักสูตร')).toHaveAccessibleName('ในหลักสูตร เลือก 0 จาก 6');

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

  it('heads the list with its group segments and keeps orange for apply', async () => {
    act(() => {
      seedActivePlan(lockSections(courses, [['04186098', '2']]));
    });
    const { portal } = renderDialog(390);
    await findCards();
    // Each segment names its group and its ticked count, the plan's subjects first, and
    // only the GenEd one starts open. No typed dot joins the parts.
    expect(segment('ในตาราง')).toHaveAccessibleName('ในตาราง เลือก 1 จาก 1');
    expect(segment('ในตาราง')).toHaveAttribute('aria-expanded', 'false');
    expect(segment('ในหลักสูตร')).toHaveAccessibleName('ในหลักสูตร เลือก 6 จาก 6');
    const other = segment('ศึกษาทั่วไปและอื่น ๆ');
    expect(other).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('group', { name: 'วิชาที่จะจัดลงตาราง' }).textContent,
    ).not.toMatch(/[\u00b7\u2022\u2027]/);
    // The open list names its subjects in full, the first rows on a phone and a control for
    // the rest, which hands focus to the first row it reveals. The capture's five GenEd and
    // other subjects are one past the phone cap of four, so all show, since one hidden row
    // is shown rather than put behind a control; its six curriculum subjects take the cap.
    const list = screen.getByRole('region', {
      name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น',
    });
    expect(other).toHaveAccessibleName('ศึกษาทั่วไปและอื่น ๆ เลือก 0 จาก 5');
    expect(within(list).getAllByRole('checkbox')).toHaveLength(5);
    expect(within(list).queryByRole('button', { name: /^แสดงอีก/ })).toBeNull();
    openGroup('ในหลักสูตร');
    const curriculum = screen.getByRole('region', {
      name: 'วิชาในหลักสูตร กลุ่ม 2',
    });
    expect(within(curriculum).getAllByRole('checkbox')).toHaveLength(4);
    fireEvent.click(
      within(curriculum).getByRole('button', { name: 'แสดงอีก 2 วิชา' }),
    );
    const all = within(curriculum).getAllByRole('checkbox');
    expect(all).toHaveLength(6);
    expect(all[4]).toHaveFocus();
    // The intro is a single sentence.
    expect(
      screen.getByText('เลือกวิชาที่ต้องการ แล้วเลือกตารางที่เวลาเรียนและเวลาสอบไม่ชนกัน'),
    ).toBeInTheDocument();
    // On a phone the apply action rides the sheet footer rather than the slide, and it is the
    // one orange fill.
    expect(
      within(shownSlide()).queryByRole('button', { name: 'ใช้ตารางนี้' }),
    ).toBeNull();
    const orange = Array.from(
      within(portal).getByRole('dialog').querySelectorAll('.bg-primary-strong'),
    );
    expect(orange.length).toBeGreaterThan(0);
    for (const element of orange) {
      expect(element).toHaveAccessibleName('ใช้ตารางนี้');
    }
    expect(
      screen.getByRole('button', { name: 'สมดุล', pressed: true }),
    ).toHaveClass('border-ink');
  });

  it('pins the pager and the apply action for the slide on show to the phone sheet footer', async () => {
    act(() => {
      seedActivePlan(lockSections(courses, [['04186098', '2']]));
    });
    const { onApplied } = renderDialog(390);
    await findCards();
    const footer = document.querySelector<HTMLElement>('[data-suggest-footer]');
    if (footer === null) throw new Error('no sheet footer');
    // The footer sits outside the scrolling body, so it covers none of the body's content.
    const body = shownSlide().closest('.kcp-scroll');
    expect(body).not.toBeNull();
    expect(body?.contains(footer)).toBe(false);
    expect(body).toHaveClass('pb-20');
    // One apply action and one pager, both in the footer; the carousel keeps its dots.
    const apply = screen.getByRole('button', { name: 'ใช้ตารางนี้' });
    expect(footer).toContainElement(apply);
    expect(footer).toContainElement(
      screen.getByRole('button', { name: 'ตัวเลือกถัดไป' }),
    );
    const position = within(footer).getByText('ตัวเลือก 1 จาก 3');
    expect(position).toHaveAttribute('aria-live', 'polite');
    expect(apply).toHaveAttribute('aria-describedby', position.id);
    expect(
      screen.getByRole('group', { name: 'ตัวเลือก 1 จาก 3' }),
    ).toHaveAttribute('aria-roledescription', 'ชุดสไลด์');

    // The footer pages the carousel, and applies the slide it now shows.
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกถัดไป' }));
    expect(within(shownSlide()).getByRole('heading')).toHaveTextContent(
      'ตัวเลือกที่ 2',
    );
    expect(within(footer).getByText('ตัวเลือก 2 จาก 3')).toBeInTheDocument();
    const shownIds = new Set(
      Array.from(
        shownSlide().querySelectorAll<HTMLElement>('[data-teach-table-id]'),
        (block) => block.dataset.teachTableId ?? '',
      ),
    );
    expect(shownIds.size).toBeGreaterThan(0);
    act(() => {
      fireEvent.click(apply);
    });
    expect(onApplied).toHaveBeenCalledOnce();
    const state = planStore.getState();
    const created = state.plans.find((plan) => plan.id === state.activePlanId);
    const placed = new Set(
      created?.entries.map((entry: PlanEntry) => entry.teachTableId),
    );
    for (const id of shownIds) {
      expect(placed.has(id)).toBe(true);
    }
  });

  it('keeps the pager and the apply action in the carousel on a wide dialog', async () => {
    renderDialog(1366);
    await findCards();
    expect(document.querySelector('[data-suggest-footer]')).toBeNull();
    expect(
      within(shownSlide()).getByRole('button', { name: 'ใช้ตารางนี้' }),
    ).toBeInTheDocument();
  });

  it('clears the current plan after a warning, as one undoable step', async () => {
    const locked = lockSections(courses, [
      ['01006020', '4'],
      ['04186098', '2'],
    ]);
    act(() => {
      seedActivePlan(locked);
    });
    const before = planStore.getState().entries;
    renderDialog();
    await findCards();
    const clear = screen.getByRole('button', { name: 'ล้างตารางปัจจุบัน' });
    fireEvent.click(clear);
    // The warning names how many subjects leave, and focus waits on the safe choice.
    const prompt = 'ล้างตารางปัจจุบันและนำวิชาออก 2 วิชา เลิกทำได้ภายใน 10 วินาที';
    expect(screen.getByText(prompt)).toBeVisible();
    const cancel = screen.getByRole('button', { name: 'ยกเลิก' });
    expect(cancel).toHaveFocus();
    expect(cancel).toHaveAccessibleDescription(prompt);
    fireEvent.click(cancel);
    expect(screen.queryByText(prompt)).toBeNull();
    expect(screen.getByRole('button', { name: 'ล้างตารางปัจจุบัน' })).toHaveFocus();
    expect(planStore.getState().entries).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'ล้างตารางปัจจุบัน' }));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'ล้างตาราง' }));
    });
    const state = planStore.getState();
    expect(state.entries).toEqual([]);
    expect(state.pendingUndo?.kind).toBe('clear');
    // The plan group and the clear action leave with the plan's subjects. The prompt's
    // place names the clear in a line inside the dialog, and its own undo takes focus with
    // the line as its description, so the way back never depends on the toast outside
    // the modal.
    expect(screen.queryByRole('button', { name: 'ล้างตารางปัจจุบัน' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^ในตาราง/ })).toBeNull();
    const cleared = 'ล้างตารางแล้ว นำออก 2 วิชา';
    expect(within(screen.getByRole('dialog')).getByText(cleared)).toBeVisible();
    const undo = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'เลิกทำ',
    });
    expect(undo).toHaveFocus();
    expect(undo).toHaveAccessibleDescription(cleared);

    // Undo from the keyboard brings the plan back and returns focus to the clear action.
    act(() => {
      fireEvent.click(undo);
    });
    expect(planStore.getState().entries).toEqual(before);
    expect(planStore.getState().pendingUndo).toBeNull();
    expect(screen.queryByText(cleared)).toBeNull();
    expect(screen.getByRole('button', { name: 'ล้างตารางปัจจุบัน' })).toHaveFocus();
  });

  it('reopens the GenEd group when a clear empties the open plan group', async () => {
    act(() => {
      seedActivePlan(lockSections(courses, [['04186098', '2']]));
    });
    renderDialog();
    await findCards();
    openGroup('ในตาราง');
    expect(segment('ในตาราง')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'ล้างตารางปัจจุบัน' }));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'ล้างตาราง' }));
    });
    expect(segment('ศึกษาทั่วไปและอื่น ๆ')).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('region', {
        name: 'วิชาศึกษาทั่วไป วิชาเลือกเสรี และวิชาอื่น',
      }),
    ).toBeVisible();
  });

  it('names one subject in the singular when it warns before a clear in English', async () => {
    act(() => {
      uiStore.getState().setLanguage('en');
      seedActivePlan(lockSections(courses, [['04186098', '2']]));
    });
    try {
      renderDialog();
      await screen.findAllByRole('button', { name: 'Use this plan' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Clear current plan' }),
      );
      expect(
        screen.getByText(
          'Clear the current plan and remove 1 subject? You can undo it for 10 seconds.',
        ),
      ).toBeVisible();
    } finally {
      act(() => {
        uiStore.getState().setLanguage('th');
      });
    }
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
    // The two goals read as a pair, most subjects beside most credits, since the subjects
    // goal can still leave a subject out.
    expect(
      screen.getByRole('button', { name: 'วิชามากที่สุด', pressed: false }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เน้นเช้า' }));
    expect(uiStore.getState().suggestPreference).toBe('morning');
  });
});
