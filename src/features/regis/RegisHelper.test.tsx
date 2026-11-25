import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { FIRST_READING_MS, RegisHelper } from './RegisHelper';
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
  // The page has been read once, so the card opens with no wait.
  hostStore.setState({
    health: { status: 'healthy' },
    page: null,
    term: { year: '2569', semester: '1' },
  });
  // Each test is a new document, with no open or collapsed choice made yet.
  helperStore.setState({ chosen: null });
  startVisit();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    // A press, which on touch shows no tooltip, shows the reason in the error toast.
    fireEvent.click(add);
    expect(toastStore.getState().toast).toMatchObject({
      kind: 'error',
      message: 'ยังใช้เพิ่มให้ไม่ได้',
    });
    expect(fillStore.getState().run.status).toBe('idle');
  });

  it('stays open on a phone when a tap lands on the page while Add for me runs', () => {
    renderPage('#/pre_registration');
    const page = document.createElement('button');
    document.body.append(page);
    const tapPage = () => {
      fireEvent.pointerDown(page, { pointerId: 1, isPrimary: true });
      fireEvent.pointerUp(page, { pointerId: 1, isPrimary: true });
    };
    act(() => {
      fillStore.setState({
        run: {
          status: 'running',
          subjectId: '01476107',
          step: 'enter',
          prerequisites: [],
          done: 0,
          total: 1,
        },
      });
    });
    act(tapPage);
    expect(card()).toBeInTheDocument();
    expect(helperStore.getState().collapsed).toBe(false);
    // With no run, a tap on the page collapses the card on a phone, as before.
    act(() => {
      fillStore.setState({ run: { status: 'idle' } });
    });
    act(tapPage);
    expect(helperStore.getState().collapsed).toBe(true);
    page.remove();
  });

  it('collapses to the launcher, and opens again on the next visit on a wide screen', () => {
    renderPage('#/pre_registration');
    // Open, the launcher names the checklist alone; the card's header has the count.
    const launcher = screen.getByRole('button', { name: 'เช็กลิสต์' });
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    expect(launcher).not.toHaveTextContent('0/1');
    fireEvent.click(launcher);
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(launcher).toHaveAccessibleName(/^เช็กลิสต์ 0\/1/);
    act(() => {
      startVisit();
    });
    expect(card()).toBeInTheDocument();
  });

  it('starts collapsed on a narrow screen until the student opens it', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(412);
    renderPage('#/pre_registration');
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
    const launcher = screen.getByRole('button', { name: /^เช็กลิสต์ 0\/1/ });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(launcher);
    expect(card()).toBeInTheDocument();
    // On a narrow screen a later visit follows the student's own choice.
    act(() => {
      startVisit(true);
    });
    expect(card()).toBeInTheDocument();
    fireEvent.click(launcher);
    act(() => {
      startVisit(true);
    });
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'เช็กลิสต์' }));
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
    // The name comes from the visible label, not from a separate copy of it.
    expect(addAll).not.toHaveAttribute('aria-label');
    expect(addAll).not.toHaveAttribute('data-fill-press');
    fireEvent.click(addAll);
    expect(toastStore.getState().toast).toMatchObject({
      kind: 'error',
      message: 'ยังใช้เพิ่มให้ไม่ได้',
    });
    expect(fillStore.getState().run.status).toBe('idle');
    // Add for me can never run on this build, so its switch is not offered.
    expect(within(menu).queryByRole('menuitemcheckbox')).toBeNull();
    const checks = hostStore.getState().checks;
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'ตรวจอีกครั้ง' }));
    expect(hostStore.getState().checks).toBe(checks + 1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('puts the add for me switch above Add all, so turning it moves nothing under it', () => {
    for (const name of ['app.454d9e95.js', 'chunk-vendors.7ab4925e.js']) {
      const script = document.createElement('script');
      script.setAttribute('src', `/js/${name}`);
      script.type = 'text/plain';
      document.head.append(script);
    }
    try {
      renderPage('#/pre_registration');
      fireEvent.click(within(card()).getByRole('button', { name: 'เพิ่มเติม' }));
      const menu = screen.getByRole('menu', { name: 'เพิ่มเติม' });
      const items = () =>
        Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
      expect(
        items()
          .slice(0, 2)
          .map((item) => item.getAttribute('role')),
      ).toEqual(['menuitemcheckbox', 'menuitem']);
      const toggle = within(menu).getByRole('menuitemcheckbox');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      // The switch stays first, so the next press in the same place turns it back.
      expect(items()[0]).toBe(toggle);
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    } finally {
      document.head.replaceChildren();
      regisStore.getState().setFillOff(false);
    }
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

  it('moves through the more menu by its first letters', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    renderPage('#/pre_registration');
    const region = screen.getByRole('region', { name: 'Checklist' });
    fireEvent.click(within(region).getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('menu', { name: 'More' });
    const first = within(menu).getByRole('menuitem', {
      name: 'Add all for me',
    });
    first.focus();
    fireEvent.keyDown(first, { key: 'h' });
    expect(
      within(menu).getByRole('menuitem', { name: 'Hide on this page' }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? menu, { key: 'C' });
    expect(
      within(menu).getByRole('menuitem', { name: 'Check again' }),
    ).toHaveFocus();
    act(() => {
      uiStore.getState().setLanguage('th');
    });
  });

  it('waits for the first page reading, at most half a second, before opening', () => {
    vi.useFakeTimers();
    try {
      hostStore.setState({ health: { status: 'waiting', strikes: 0 } });
      renderPage('#/pre_registration');
      expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
      act(() => {
        hostStore.setState({ health: { status: 'healthy' } });
      });
      expect(card()).toBeInTheDocument();
      // A page that shows nothing to read yet opens the card once the wait runs out.
      act(() => {
        hostStore.setState({ health: { status: 'waiting', strikes: 0 } });
        startVisit();
      });
      expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
      act(() => {
        vi.advanceTimersByTime(FIRST_READING_MS);
      });
      expect(card()).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens at once on the registration page, which KCP does not read', () => {
    hostStore.setState({ health: { status: 'waiting', strikes: 0 } });
    renderPage('#/registration');
    expect(card()).toBeInTheDocument();
  });

  it('renders nothing off the helper pages', () => {
    renderPage('#/teach_table_selector');
    expect(screen.queryByRole('region', { name: 'เช็กลิสต์' })).toBeNull();
  });
});
