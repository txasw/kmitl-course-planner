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

  it('opens as the bottom sheet on a compact panel', async () => {
    renderDialog(375);
    expect(screen.getByRole('dialog', { name: 'แนะนำตาราง' })).toBeVisible();
    expect(await findCards()).toHaveLength(3);
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

  it('has no serious accessibility violations when open', async () => {
    const { portal } = renderDialog();
    await findCards();
    const dialog = within(portal).getByRole('dialog');
    await expectNoSeriousA11yViolations(dialog);
  });
});
