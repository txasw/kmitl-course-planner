import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import type { Plan } from '@/lib/domain/plan';
import { toSnapshot } from '@/lib/planner/transaction';
import { INITIAL_HEALTH } from '@/lib/regis/observerHealth';
import type { Term } from '@/lib/routing/academicTerms';
import { Launcher } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from '@/features/plans/planStore';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { fillStore } from './fill/fillRun';
import { startVisit } from './helperStore';
import { hostStore } from './host/hostStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// The helper card follows the term the page registers: with several plans of that term
// the more menu lets the student pick which one it follows, and the planner's active plan
// stays as it was.

const TERM2: Term = { year: '2569', semester: '2' };

function planOf(
  id: string,
  name: string,
  term: Term,
  subjectId: string,
  updatedAt: string,
): Plan {
  const course = makeCourse({
    subjectId,
    nameTh: `วิชา ${subjectId}`,
    sections: [makeSection({ teachTableId: `T${subjectId}`, subjectId })],
  });
  const snapshot = toSnapshot(course, course.sections[0] ?? makeSection());
  return makePlan({
    id,
    name,
    year: term.year,
    semester: term.semester,
    updatedAt,
    entries: [
      makePlanEntry({
        snapshot,
        sourceQuery: {
          endpoint: 'get-teach-table-show',
          params: {
            mode: 'by_subject_id',
            selected_year: term.year,
            selected_semester: term.semester,
          },
        },
      }),
    ],
  });
}

const SEM1 = planOf(
  'sem1',
  'ตาราง 1/2569',
  { year: '2569', semester: '1' },
  '01000001',
  '2026-11-20T00:00:00.000Z',
);
const SEM2 = planOf(
  'sem2',
  'ตาราง 2/2569',
  TERM2,
  '02000002',
  '2026-11-01T00:00:00.000Z',
);
// The latest plan of the page term, which the helper follows until one is picked.
const SEM2B = planOf(
  'sem2-b',
  'สำรอง 2/2569',
  TERM2,
  '02000003',
  '2026-11-10T00:00:00.000Z',
);

function renderOn(plans: Plan[], active: string, term: Term | null) {
  window.location.hash = '#/pre_registration';
  act(() => {
    planStore.getState().hydrate(plans);
    planStore.getState().setActivePlan(active);
    hostStore.getState().record(
      { surrogate: false, build: 'tested' as const },
      {
        reading: 'ok',
        observation: {
          step: 2,
          term,
          card: null,
          list: [],
          credits: null,
          dialog: null,
          toasts: [],
          results: null,
        },
      },
    );
  });
  render(
    <>
      <RegisHelper />
      <Launcher />
    </>,
  );
  return screen.getByRole('region', { name: 'เช็กลิสต์' });
}

beforeEach(() => {
  regisStore.setState({ kits: [], choices: [] });
  startVisit();
});

afterEach(() => {
  cleanup();
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  act(() => {
    uiStore.getState().close();
    hostStore.setState({
      health: INITIAL_HEALTH,
      page: null,
      term: null,
      lastTerm: null,
      termWaitOver: false,
      termWaitDue: false,
      conditional: {},
    });
  });
  window.location.hash = '';
});

describe('the helper before the page term is read', () => {
  it('names no plan, no subject, and no count while the term may still arrive', () => {
    const card = renderOn([SEM1, SEM2], 'sem1', null);
    expect(card).toHaveTextContent('กำลังอ่านภาคการศึกษาจากหน้านี้');
    expect(card).not.toHaveTextContent('01000001');
    expect(card).not.toHaveTextContent('02000002');
    expect(card).not.toHaveTextContent('0/1');
    const launcher = screen.getByRole('button', { name: 'เช็กลิสต์' });
    expect(launcher).not.toHaveTextContent('/');

    act(() => {
      hostStore.getState().record(
        { surrogate: false, build: 'tested' as const },
        {
          reading: 'ok',
          observation: {
            step: 2,
            term: TERM2,
            card: null,
            list: [],
            credits: null,
            dialog: null,
            toasts: [],
            results: null,
          },
        },
      );
    });
    expect(card).toHaveTextContent('02000002');
    expect(card).not.toHaveTextContent('01000001');
    expect(card.querySelector('[data-helper-plan-term]')).toBeNull();
  });

  it('labels the fallback plan with its own term once the wait runs out', () => {
    const card = renderOn([SEM1, SEM2], 'sem1', null);
    act(() => {
      hostStore.getState().endTermWait();
    });
    expect(card).toHaveTextContent('01000001');
    const label = card.querySelector('[data-helper-plan-term]');
    expect(label).toHaveTextContent('ตาราง 1/2569');
    expect(label).toHaveTextContent(
      'ตารางของภาคการศึกษา 1/2569 KCP ยังอ่านภาคการศึกษาของหน้านี้ไม่ได้',
    );
  });

  it('says on regular registration that KCP does not read the page, not that it could not', () => {
    window.location.hash = '#/registration';
    act(() => {
      planStore.getState().hydrate([SEM1]);
      planStore.getState().setActivePlan('sem1');
    });
    render(<RegisHelper />);
    const card = screen.getByRole('region', { name: 'เช็กลิสต์' });
    expect(card).toHaveTextContent('01000001');
    const label = card.querySelector('[data-helper-plan-term]');
    expect(label).toHaveTextContent(
      'ตารางของภาคการศึกษา 1/2569 KCP ไม่อ่านข้อมูลจากหน้านี้',
    );
    expect(label).not.toHaveTextContent('ยังอ่านภาคการศึกษาของหน้านี้ไม่ได้');
    // No host check runs on this route, so Add for me names the page, not a check.
    const add = within(card).getByRole('button', { name: 'เพิ่มให้' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription(
      'เพิ่มให้ใช้ได้ในหน้าลงทะเบียนล่วงหน้า กรอกรหัสวิชาจากเช็กลิสต์',
    );
  });

  it('shows no count on the folded launcher for a plan of an unread term', () => {
    renderOn([SEM1, SEM2], 'sem1', null);
    act(() => {
      hostStore.getState().endTermWait();
    });
    const launcher = screen.getByRole('button', { name: /^เช็กลิสต์/ });
    fireEvent.click(launcher);
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(launcher).not.toHaveTextContent('/');
    expect(launcher).toHaveAccessibleName('เช็กลิสต์');
    // Once the page term is read, the launcher counts the plan of that term.
    act(() => {
      hostStore.getState().record(
        { surrogate: false, build: 'tested' as const },
        {
          reading: 'ok',
          observation: {
            step: 2,
            term: TERM2,
            card: null,
            list: [],
            credits: null,
            dialog: null,
            toasts: [],
            results: null,
          },
        },
      );
    });
    expect(launcher).toHaveTextContent('0/1');
  });
});

describe('the helper on a page of another term than the active plan', () => {
  it('lists the plan of the page term and offers its other plans in the menu', () => {
    const card = renderOn([SEM1, SEM2, SEM2B], 'sem1', TERM2);
    expect(card).toHaveTextContent('02000003');
    expect(card).not.toHaveTextContent('01000001');

    fireEvent.click(within(card).getByRole('button', { name: 'เพิ่มเติม' }));
    const menu = screen.getByRole('menu', { name: 'เพิ่มเติม' });
    const group = within(menu).getByRole('group', {
      name: 'ตารางของภาค 2/2569',
    });
    const options = within(group).getAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual([
      'ตาราง 2/2569',
      'สำรอง 2/2569',
    ]);
    expect(
      within(group).getByRole('menuitemradio', { name: 'สำรอง 2/2569' }),
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(
      within(group).getByRole('menuitemradio', { name: 'ตาราง 2/2569' }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
    expect(card).toHaveTextContent('02000002');
    expect(planStore.getState().activePlanId).toBe('sem1');
  });

  it('keeps the plan choice on a picked plan with no subjects, so the student gets back', () => {
    const empty = makePlan({
      id: 'sem2-empty',
      name: 'ว่าง 2/2569',
      year: TERM2.year,
      semester: TERM2.semester,
      updatedAt: '2026-10-01T00:00:00.000Z',
      entries: [],
    });
    const card = renderOn([SEM2, empty], 'sem2', TERM2);
    const pick = (name: string) => {
      fireEvent.click(within(card).getByRole('button', { name: 'เพิ่มเติม' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name }));
    };
    pick('ว่าง 2/2569');
    expect(card).not.toHaveTextContent('02000002');
    fireEvent.click(within(card).getByRole('button', { name: 'เพิ่มเติม' }));
    const menu = screen.getByRole('menu', { name: 'เพิ่มเติม' });
    expect(
      within(menu).getByRole('menuitem', { name: 'ซ่อนในหน้านี้' }),
    ).toBeVisible();
    fireEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'ตาราง 2/2569' }),
    );
    expect(card).toHaveTextContent('02000002');
  });

  it('keeps the more menu on a page term with no plan', () => {
    const card = renderOn([SEM1], 'sem1', TERM2);
    fireEvent.click(within(card).getByRole('button', { name: 'เพิ่มเติม' }));
    const menu = screen.getByRole('menu', { name: 'เพิ่มเติม' });
    expect(
      within(menu).getByRole('menuitem', { name: 'ซ่อนในหน้านี้' }),
    ).toBeVisible();
  });

  it('offers no plan choice when the page term has one plan', () => {
    const card = renderOn([SEM1, SEM2], 'sem1', TERM2);
    fireEvent.click(within(card).getByRole('button', { name: 'เพิ่มเติม' }));
    const menu = screen.getByRole('menu', { name: 'เพิ่มเติม' });
    expect(within(menu).queryByRole('menuitemradio')).toBeNull();
  });

  it('offers to make a plan for a page term with none, only on a press', () => {
    const card = renderOn([SEM1], 'sem1', TERM2);
    expect(card).toHaveTextContent('ยังไม่มีตารางของภาค 2/2569');
    expect(card).not.toHaveTextContent('01000001');
    expect(planStore.getState().plans).toHaveLength(1);
    expect(planStore.getState().activePlanId).toBe('sem1');

    fireEvent.click(
      within(card).getByRole('button', { name: 'สร้างตาราง 2/2569' }),
    );
    const { plans, activePlanId } = planStore.getState();
    const created = plans.find((plan) => plan.id === activePlanId);
    expect(created).toMatchObject({ year: '2569', semester: '2' });
    expect(uiStore.getState().isOpen).toBe(true);
  });
});
