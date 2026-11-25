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
import { INITIAL_HEALTH, type OffReason } from '@/lib/regis/observerHealth';
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

// The bar of a page KCP cannot read: when a reading can help, the whole bar is Check
// again, its words included, and a drift off page reads again; when none can, on a host
// build KCP was not tested with or in a staff session, the bar is plain and neither it nor
// the more menu offers a dead Check again.

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

function renderOff(reason: OffReason) {
  window.location.hash = '#/pre_registration';
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
  act(() => {
    hostStore.setState({ health: { status: 'off', reason } });
  });
  return screen.getByRole('region', { name: 'เช็กลิสต์' });
}

function openMore(card: HTMLElement) {
  fireEvent.click(within(card).getByRole('button', { name: 'เพิ่มเติม' }));
  return screen.getByRole('menu', { name: 'เพิ่มเติม' });
}

beforeEach(() => {
  regisStore.setState({ kits: [], choices: [] });
  // The page has been read once, so the card opens with no wait.
  hostStore.setState({ health: { status: 'healthy' }, page: null });
  startVisit();
});

afterEach(() => {
  cleanup();
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  act(() => {
    uiStore.getState().close();
    hostStore.setState({ health: INITIAL_HEALTH, page: null, checks: 0 });
  });
  window.location.hash = '';
});

describe('the unreadable bar', () => {
  it('is one press whose words check a drifted page again', () => {
    const card = renderOff('drift');
    const bar = within(card).getByRole('button', {
      name: 'อ่านหน้าไม่ได้ ตรวจอีกครั้ง',
    });
    expect(bar).toHaveTextContent('ตรวจอีกครั้ง');
    const checks = hostStore.getState().checks;
    fireEvent.click(within(bar).getByText('อ่านหน้าไม่ได้'));
    expect(hostStore.getState().checks).toBe(checks + 1);
    expect(hostStore.getState().health.status).not.toBe('off');
  });

  it('offers Check again in the more menu for a drifted page', () => {
    const card = renderOff('drift');
    const item = within(openMore(card)).getByRole('menuitem', {
      name: 'ตรวจอีกครั้ง',
    });
    fireEvent.click(item);
    expect(hostStore.getState().health.status).not.toBe('off');
  });

  it('says the page was updated, with no control, on an untested build', () => {
    const card = renderOff('untestedBuild');
    expect(
      within(card).getByText('หน้าลงทะเบียนเปลี่ยนรุ่น กรอกเองได้ตามรายการ'),
    ).toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: /ตรวจอีกครั้ง/ }),
    ).toBeNull();
    expect(
      within(openMore(card)).queryByRole('menuitem', { name: 'ตรวจอีกครั้ง' }),
    ).toBeNull();
  });

  it('offers no Check again in a staff session', () => {
    const card = renderOff('surrogate');
    expect(within(card).getByText('อ่านหน้าไม่ได้')).toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: /ตรวจอีกครั้ง/ }),
    ).toBeNull();
    expect(
      within(openMore(card)).queryByRole('menuitem', { name: 'ตรวจอีกครั้ง' }),
    ).toBeNull();
    expect(hostStore.getState().health).toEqual({
      status: 'off',
      reason: 'surrogate',
    });
  });
});
