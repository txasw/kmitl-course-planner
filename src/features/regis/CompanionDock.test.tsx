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
import { CompanionDock } from './CompanionDock';
import { regisStore } from './regisStore';

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
      <Launcher />
      <CompanionDock />
    </>,
  );
}

beforeEach(() => {
  regisStore.setState({
    kits: [],
    choices: [],
    dockOpen: false,
    dockExpanded: null,
    sheetLevel: 'peek',
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
  });
  window.location.hash = '';
});

describe('CompanionDock', () => {
  it('opens beside the pre registration page instead of the panel', () => {
    renderPage('#/pre_registration');
    fireEvent.click(
      screen.getByRole('button', { name: 'เปิดเช็กลิสต์ ตัวช่วยลงทะเบียน' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(uiStore.getState().isOpen).toBe(false);
    const dock = screen.getByRole('complementary', { name: 'ตัวช่วยลงทะเบียน' });
    expect(within(dock).getByText('เช็กลิสต์ 0/1')).toBeInTheDocument();
  });

  it('lists the plan from the raised sheet', () => {
    renderPage('#/pre_registration');
    act(() => {
      regisStore.getState().setDockOpen(true);
      regisStore.getState().setSheetLevel('half');
    });
    const dock = screen.getByRole('complementary', { name: 'ตัวช่วยลงทะเบียน' });
    expect(within(dock).getAllByText('01476107').length).toBeGreaterThan(0);
    expect(
      within(dock).getByText('ลงทะเบียนล่วงหน้าส่งได้ครั้งเดียวและแก้ไขภายหลังไม่ได้'),
    ).toBeInTheDocument();
    expect(within(dock).getByText('เช็กลิสต์ 0/1')).toBeInTheDocument();
  });

  it('lowers a raised sheet to its peek bar on a press on the page', () => {
    renderPage('#/pre_registration');
    act(() => {
      regisStore.getState().setDockOpen(true);
      regisStore.getState().setSheetLevel('half');
    });
    const dock = screen.getByRole('complementary', { name: 'ตัวช่วยลงทะเบียน' });
    fireEvent.pointerDown(
      within(dock).getByRole('button', { name: 'คัดลอกรหัสวิชา 01476107' }),
    );
    expect(regisStore.getState().sheetLevel).toBe('half');
    fireEvent.pointerDown(document.body);
    expect(regisStore.getState().sheetLevel).toBe('peek');
  });

  it('says on regular registration that the student checks the list', () => {
    renderPage('#/registration');
    act(() => {
      regisStore.getState().setDockOpen(true);
      regisStore.getState().setSheetLevel('full');
    });
    expect(
      screen.getByText(
        'ในหน้านี้ KCP แสดงรายการตามตารางเท่านั้น คุณเป็นผู้ตรวจรายการในหน้าลงทะเบียนเอง',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ส่งได้ครั้งเดียว/)).not.toBeInTheDocument();
  });

  it('leaves the panel launcher alone on other pages', () => {
    renderPage('#/teach_table_selector');
    fireEvent.click(
      screen.getByRole('button', { name: 'เปิด KCP: Course Planner for KMITL' }),
    );
    expect(uiStore.getState().isOpen).toBe(true);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
