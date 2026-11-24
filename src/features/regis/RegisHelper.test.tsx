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
import { helperStore, startVisit } from './helperStore';
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
    fireEvent.click(count);
    expect(count).toHaveAttribute('aria-expanded', 'true');
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

  it('renders nothing off the helper pages', () => {
    renderPage('#/teach_table_selector');
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
  });
});
