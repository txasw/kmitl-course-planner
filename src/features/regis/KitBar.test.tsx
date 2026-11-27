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
import { planStore } from '@/features/plans/planStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { Plan } from '@/lib/domain/plan';
import { withChoice } from '@/lib/regis/choices';
import { KIT_MAX_AGE_MS, buildRegistrationKit } from '@/lib/regis/kit';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toastStore } from '@/features/shell/toastStore';
import { fillStore } from './fill/fillRun';
import { hostStore } from './host/hostStore';
import { setCollapsed, startVisit } from './helperStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// The helper's bar for a plan with nothing prepared: one line with the reason, and on the
// pre registration page the press that prepares there, its progress with Cancel, and Add
// for me held with its reason while it reads. The registration page offers no press.

const COURSE = makeCourse({
  subjectId: '01476107',
  nameTh: 'การเขียนโปรแกรม',
  sections: [makeSection({ teachTableId: 'T1', subjectId: '01476107' })],
});
const PLAN = makePlan({
  entries: [
    makePlanEntry({
      snapshot: toSnapshot(COURSE, COURSE.sections[0] ?? makeSection()),
    }),
  ],
});

// The bar must send nothing in these tests, so the send only counts.
let sends = 0;
const send: TypedSend = () => {
  sends += 1;
  return new Promise<never>(() => undefined);
};

function renderOn(hash: string, plan: Plan = PLAN) {
  window.location.hash = hash;
  act(() => {
    planStore.getState().hydrate([plan]);
    planStore.getState().setActivePlan(plan.id);
  });
  render(
    <SearchDepsProvider
      value={{
        send,
        repo: {
          load: () => Promise.resolve(null),
          save: () => Promise.resolve(),
        },
      }}
    >
      <RegisHelper />
      <Launcher />
    </SearchDepsProvider>,
  );
  act(() => {
    setCollapsed(false);
  });
  return screen.getByRole('region', { name: 'เช็กลิสต์' });
}

beforeEach(() => {
  // A tested host build, so Add for me is held by the missing kit and not by the build.
  for (const name of ['app.a1e43722.js', 'chunk-vendors.7ab4925e.js']) {
    const script = document.createElement('script');
    script.setAttribute('src', `/js/${name}`);
    script.type = 'text/plain';
    document.head.append(script);
  }
  regisStore.setState({ kits: [], choices: [], run: { status: 'idle' } });
  hostStore.setState({
    health: { status: 'healthy' },
    page: null,
    term: { year: '2569', semester: '1' },
  });
  startVisit();
  sends = 0;
});

afterEach(() => {
  cleanup();
  document.head.replaceChildren();
  regisStore.setState({ run: { status: 'idle' } });
  hostStore.setState({ termWaitOver: false });
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  window.location.hash = '';
});

describe('the kit bar', () => {
  it('states the reason once and offers Prepare data on pre registration', () => {
    const card = renderOn('#/pre_registration');
    expect(within(card).getAllByText('ยังไม่ได้เตรียมข้อมูล')).toHaveLength(1);
    const add = within(card).getByRole('button', { name: 'เพิ่มให้' });
    expect(add).toHaveAttribute('aria-describedby', 'kcp-regis-kit');
    const prepare = within(card).getByRole('button', { name: 'เตรียมข้อมูล' });
    // A press the browser did not make starts nothing.
    fireEvent.click(prepare);
    expect(sends).toBe(0);
    expect(regisStore.getState().run.status).toBe('idle');
  });

  it('offers no press on the registration page', () => {
    const card = renderOn('#/registration');
    expect(within(card).getByText('ยังไม่ได้เตรียมข้อมูล')).toBeVisible();
    expect(
      within(card).queryByRole('button', { name: 'เตรียมข้อมูล' }),
    ).toBeNull();
  });

  it('offers no press for a plan of a term the page has not shown', () => {
    hostStore.setState({ term: null, termWaitOver: true });
    const card = renderOn('#/pre_registration');
    expect(within(card).getByText('ยังไม่ได้เตรียมข้อมูล')).toBeVisible();
    expect(card.querySelector('[data-helper-plan-term]')).not.toBeNull();
    expect(
      within(card).queryByRole('button', { name: 'เตรียมข้อมูล' }),
    ).toBeNull();
  });

  it('shows the progress with Cancel and holds Add for me while it reads', () => {
    const card = renderOn('#/pre_registration');
    act(() => {
      regisStore
        .getState()
        .setRun({ status: 'running', planId: PLAN.id, done: 1, total: 3 });
    });
    expect(within(card).getByText('กำลังอ่านวิชา 1 จาก 3')).toBeVisible();
    expect(within(card).getByRole('button', { name: 'ยกเลิก' })).toBeVisible();
    expect(
      within(card).queryByRole('button', { name: 'เตรียมข้อมูล' }),
    ).toBeNull();
    const add = within(card).getByRole('button', { name: 'เพิ่มให้' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).not.toHaveAttribute('data-fill-press');
    expect(add).toHaveAttribute('aria-describedby', 'kcp-regis-kit');
    fireEvent.click(add);
    expect(fillStore.getState().run.status).toBe('idle');
  });

  it('holds the press with its reason while another plan prepares', () => {
    const card = renderOn('#/pre_registration');
    act(() => {
      regisStore
        .getState()
        .setRun({ status: 'running', planId: 'another', done: 1, total: 4 });
    });
    const prepare = within(card).getByRole('button', {
      name: 'เตรียมข้อมูล, กำลังเตรียมข้อมูลของตารางอื่นอยู่',
    });
    expect(prepare).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(prepare);
    expect(toastStore.getState().toast).toMatchObject({
      kind: 'error',
      message: 'กำลังเตรียมข้อมูลของตารางอื่นอยู่',
    });
    expect(sends).toBe(0);
    expect(regisStore.getState().run).toMatchObject({ planId: 'another' });
  });

  it('says a failed read and offers the press again', () => {
    const card = renderOn('#/pre_registration');
    act(() => {
      regisStore.getState().setRun({ status: 'failed', planId: PLAN.id });
    });
    expect(within(card).getByText('อ่านข้อมูลไม่สำเร็จ')).toBeVisible();
    expect(
      within(card).getByRole('button', { name: 'เตรียมข้อมูล' }),
    ).toBeVisible();
  });
});

describe('the kit bar over data past the age limit', () => {
  const SUBJECT = '01476108';
  const course = makeCourse({
    subjectId: SUBJECT,
    nameTh: 'โครงสร้างข้อมูล',
    sections: [
      makeSection({ teachTableId: 'S1', subjectId: SUBJECT, section: '1' }),
      makeSection({ teachTableId: 'S2', subjectId: SUBJECT, section: '2' }),
    ],
  });
  const planned = course.sections[0] ?? makeSection();
  const plan = makePlan({
    id: 'stale-plan',
    entries: [
      makePlanEntry({
        subjectId: SUBJECT,
        teachTableId: planned.teachTableId,
        section: planned.section,
        snapshot: toSnapshot(course, planned),
      }),
    ],
  });

  function storeOldKit() {
    const kit = buildRegistrationKit({
      plan,
      results: new Map([
        [
          SUBJECT,
          {
            courses: [course],
            duplicateCount: 0,
            multiMeetingCount: 0,
            warnings: [],
          },
        ],
      ]),
      preparedAt: new Date(
        Date.now() - KIT_MAX_AGE_MS - 86_400_000,
      ).toISOString(),
    });
    regisStore.setState({
      kits: [kit],
      choices: [withChoice(null, plan, SUBJECT, ['S2'])],
    });
  }

  const BAR_HERE = 'ข้อมูลกลุ่มเรียนเก่ากว่า 7 วัน เตรียมอีกครั้งในเวลาที่ระบบไม่หนาแน่น';

  it('keeps the saved choice as older data and offers to prepare again, never to fill', () => {
    storeOldKit();
    const card = renderOn('#/pre_registration', plan);
    const bar = card.querySelector('[data-kit-bar]');
    expect(bar).toHaveAttribute('data-kit-bar', 'stale');
    expect(bar).toHaveTextContent(BAR_HERE);
    expect(
      within(card).getByRole('button', { name: 'เตรียมอีกครั้ง' }),
    ).toBeVisible();
    expect(card.querySelector('[data-older-data]')).toHaveTextContent(
      'กลุ่มเรียนที่เลือกมาจากข้อมูลที่เก่ากว่า 7 วัน',
    );
    // Add for me reads the bar's words, so the card gives one instruction, not two.
    const add = within(card).getByRole('button', { name: 'เพิ่มให้' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAttribute('aria-describedby', 'kcp-regis-kit');
    expect(add).toHaveAccessibleDescription(BAR_HERE);
    expect(within(card).getAllByText(/เก่ากว่า 7 วัน เตรียม/)).toHaveLength(1);
    expect(card.querySelector('[data-fill-press]')).toBeNull();
    fireEvent.click(add);
    expect(fillStore.getState().run.status).toBe('idle');
    expect(sends).toBe(0);
  });

  it('says the data is older on regular registration and names where to prepare', () => {
    storeOldKit();
    const card = renderOn('#/registration', plan);
    const bar = card.querySelector('[data-kit-bar]');
    expect(bar).toHaveAttribute('data-kit-bar', 'stale');
    expect(bar).toHaveTextContent(
      'ข้อมูลกลุ่มเรียนเก่ากว่า 7 วัน เตรียมอีกครั้งที่หน้าค้นหารายวิชา',
    );
    expect(
      within(card).queryByRole('button', { name: 'เตรียมอีกครั้ง' }),
    ).toBeNull();
    expect(card.querySelector('[data-older-data]')).not.toBeNull();
    expect(card.querySelector('[data-fill-press]')).toBeNull();
    expect(sends).toBe(0);
  });

  it('lists the other sections with their facts, marked as from older data', () => {
    storeOldKit();
    const card = renderOn('#/pre_registration', plan);
    fireEvent.click(within(card).getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).toHaveTextContent(/ลงตัว|เวลาชน|สอบชน|ปิดกลุ่ม|เต็ม/);
    }
    expect(listbox).toHaveTextContent('จากข้อมูลกลุ่มเรียนที่เก่ากว่า 7 วัน');
    expect(listbox).not.toHaveTextContent('ยังไม่ได้เตรียมข้อมูล');
    expect(sends).toBe(0);
  });
});
