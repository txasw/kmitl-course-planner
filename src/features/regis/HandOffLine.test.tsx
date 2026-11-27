import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { HostObservation } from '@/lib/regis/hostObservation';
import { INITIAL_HEALTH } from '@/lib/regis/observerHealth';
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
import { fillStore } from './fill/fillRun';
import { helperStore, startVisit } from './helperStore';
import { hostStore } from './host/hostStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// The hand off line (owner answer B1): one line in the helper card once the pre
// registration page lists every planned subject, which names the host's continue control
// as text only and never takes focus.

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
const LISTED = {
  subjectId: '01476107',
  section: '901',
  kind: 'lecture',
  curriculum: null,
} as const;

function observation(patch: Partial<HostObservation>): HostObservation {
  return {
    step: 2,
    term: { year: '2569', semester: '1' },
    card: null,
    list: [],
    credits: null,
    dialog: null,
    toasts: [],
    results: null,
    ...patch,
  };
}

function renderOn(hash: string, patch: Partial<HostObservation>) {
  window.location.hash = hash;
  act(() => {
    planStore.getState().hydrate([PLAN]);
    planStore.getState().setActivePlan(PLAN.id);
    hostStore
      .getState()
      .record(
        { surrogate: false, build: 'tested' },
        { reading: 'ok', observation: observation(patch) },
      );
  });
  render(
    <>
      <RegisHelper />
      <Launcher />
    </>,
  );
}

function line() {
  return document.querySelector('[data-helper-handoff]');
}

beforeEach(() => {
  regisStore.setState({ kits: [], choices: [] });
  helperStore.setState({ chosen: null });
  startVisit();
});

afterEach(() => {
  cleanup();
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  act(() => {
    uiStore.getState().close();
    hostStore.setState({ health: INITIAL_HEALTH, page: null, term: null });
  });
  window.location.hash = '';
});

describe('the hand off line', () => {
  it('shows once the page lists every planned subject, and takes no focus', () => {
    const before = document.activeElement;
    renderOn('#/pre_registration', { list: [LISTED] });
    expect(screen.getByRole('region', { name: 'เช็กลิสต์' })).toContainElement(
      line() as HTMLElement | null,
    );
    expect(line()).toHaveTextContent(
      'ครบทุกวิชาตามแผนแล้ว ตรวจรายการบนหน้าเว็บ แล้วกด ดำเนินการต่อ ด้วยตนเอง ลงทะเบียนล่วงหน้าส่งได้ครั้งเดียว',
    );
    expect(document.querySelectorAll('[data-helper-handoff]')).toHaveLength(1);
    expect(line()?.querySelector('button, a, [tabindex]')).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it('stays hidden while a planned subject is not on the list', () => {
    renderOn('#/pre_registration', { list: [] });
    expect(screen.getByRole('region', { name: 'เช็กลิสต์' })).toBeVisible();
    expect(line()).toBeNull();
  });

  it('stays hidden while the host confirm dialog is open', () => {
    renderOn('#/pre_registration', {
      list: [LISTED],
      dialog: { kind: 'confirmSubmit', prerequisites: [] },
    });
    expect(screen.getByRole('region', { name: 'เช็กลิสต์' })).toBeVisible();
    expect(line()).toBeNull();
  });

  it('stays hidden once the page shows the submitted list', () => {
    renderOn('#/pre_registration', {
      step: 3,
      list: null,
      results: [{ ...LISTED, result: 'waiting' }],
    });
    expect(screen.getByRole('region', { name: 'เช็กลิสต์' })).toBeVisible();
    expect(line()).toBeNull();
  });

  it('stays hidden on the regular registration page, which KCP does not read', () => {
    renderOn('#/registration', { list: [LISTED] });
    expect(screen.getByRole('region', { name: 'เช็กลิสต์' })).toBeVisible();
    expect(line()).toBeNull();
  });
});
