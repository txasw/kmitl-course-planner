import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { toSnapshot } from '@/lib/planner/transaction';
import { Launcher } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from '@/features/plans/planStore';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toastStore } from '@/features/shell/toastStore';
import { fillStore } from './fill/fillRun';
import { hostStore } from './host/hostStore';
import { helperStore, setView, startVisit } from './helperStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// The registration helper card (ADR-0076, design C2): it opens on its own on each visit,
// names each subject by id and name, shows no native select, toggles the list from the
// count, explains a disabled Add for me, and collapses to the launcher and back.

const COURSE = makeCourse({
  subjectId: '01476107',
  nameTh: 'การเขียนโปรแกรม',
  nameEn: 'Programming',
  sections: [
    makeSection({ teachTableId: 'T1', subjectId: '01476107', section: '2' }),
  ],
});
const PLAN = makePlan({
  entries: [
    makePlanEntry({
      snapshot: toSnapshot(COURSE, COURSE.sections[0] ?? makeSection()),
    }),
  ],
});

function renderPage(hash: string) {
  window.location.hash = hash;
  act(() => {
    planStore.getState().hydrate([PLAN]);
    planStore.getState().setActivePlan(PLAN.id);
  });
  render(
    <>
      <RegisHelper />
      <Launcher />
    </>,
  );
}

function card() {
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
  });
  window.location.hash = '';
});

describe('RegisHelper', () => {
  it('opens on its own with the subject named by id and name, and no select', () => {
    renderPage('#/pre_registration');
    const chip = within(card()).getByRole('button', {
      name: '01476107 การเขียนโปรแกรม, ยังไม่เพิ่ม',
    });
    expect(chip).toHaveTextContent('01476107');
    expect(card().querySelector('select')).toBeNull();
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('toggles the list of every subject from the count', () => {
    renderPage('#/pre_registration');
    const count = within(card()).getByRole('button', { name: /^เพิ่มแล้ว 0\/1/ });
    expect(count).toHaveAttribute('aria-expanded', 'false');
    expect(count).toHaveAccessibleName('เพิ่มแล้ว 0/1, ดูทั้งหมด');
    fireEvent.click(count);
    expect(count).toHaveAttribute('aria-expanded', 'true');
    expect(count).toHaveAccessibleName('เพิ่มแล้ว 0/1, ย่อรายการ');
    const list = within(card()).getByRole('list', { name: 'รายวิชา' });
    fireEvent.click(within(list).getByRole('button', { name: /^01476107/ }));
    expect(helperStore.getState().view).toBe('card');
  });

  it('explains why Add for me cannot run and starts nothing', () => {
    renderPage('#/pre_registration');
    const add = within(card()).getByRole('button', { name: 'เพิ่มให้' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    const reason = add.getAttribute('aria-describedby');
    expect(reason).not.toBeNull();
    expect(add).not.toHaveAttribute('data-fill-press');
  });

  it('collapses to the launcher and opens again on the next visit', () => {
    renderPage('#/pre_registration');
    const launcher = screen.getByRole('button', { name: /^เช็กลิสต์ 0\/1/ });
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(launcher);
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      startVisit();
    });
    expect(card()).toBeInTheDocument();
  });

  it('collapses on Escape inside the card', () => {
    renderPage('#/pre_registration');
    fireEvent.keyDown(within(card()).getByRole('button', { name: 'เพิ่มเติม' }), {
      key: 'Escape',
    });
    expect(helperStore.getState().collapsed).toBe(true);
  });

  it('records the condition as shown only while the card shows it', () => {
    renderPage('#/pre_registration');
    act(() => {
      fillStore.setState({
        run: {
          status: 'running',
          subjectId: '01476107',
          step: 'conditional',
          prerequisites: ['01476105'],
          done: 0,
          total: 1,
        },
      });
    });
    expect(within(card()).getByText(/01476105/)).toBeInTheDocument();
    expect(fillStore.getState().shown?.subjectId).toBe('01476107');
    act(() => {
      setView('list');
    });
    expect(fillStore.getState().shown).toBeNull();
    act(() => {
      setView('card');
    });
    expect(fillStore.getState().shown?.subjectId).toBe('01476107');
    fireEvent.click(screen.getByRole('button', { name: /^เช็กลิสต์ 0\/1/ }));
    expect(fillStore.getState().shown).toBeNull();
  });

  it('offers Add all for me and Check again in the more menu', () => {
    renderPage('#/pre_registration');
    fireEvent.click(within(card()).getByRole('button', { name: 'เพิ่มเติม' }));
    const menu = screen.getByRole('menu', { name: 'เพิ่มเติม' });
    // Off the tested host build the item stays, with its reason, and starts nothing.
    const addAll = within(menu).getByRole('menuitem', {
      name: 'เพิ่มให้ทุกวิชา',
    });
    expect(addAll).toHaveAttribute('aria-disabled', 'true');
    expect(addAll).toHaveAccessibleDescription('ยังใช้เพิ่มให้ไม่ได้');
    expect(addAll).not.toHaveAttribute('data-fill-press');
    fireEvent.click(addAll);
    expect(toastStore.getState().toast).toMatchObject({
      kind: 'error',
      message: 'ยังใช้เพิ่มให้ไม่ได้',
    });
    expect(fillStore.getState().run.status).toBe('idle');
    const checks = hostStore.getState().checks;
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'ตรวจอีกครั้ง' }));
    expect(hostStore.getState().checks).toBe(checks + 1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('scrolls the queue and the subject in focus, and keeps the action in view', () => {
    renderPage('#/pre_registration');
    const queue = within(card()).getByRole('list', { name: 'รายวิชา' });
    const scroller = queue.closest('.overflow-y-auto');
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveTextContent('ยังไม่เพิ่ม');
    expect(scroller).toHaveTextContent('การเขียนโปรแกรม');
    const add = within(card()).getByRole('button', { name: 'เพิ่มให้' });
    expect(scroller?.contains(add)).toBe(false);
  });

  it('renders nothing off the helper pages', () => {
    renderPage('#/teach_table_selector');
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
  });
});
