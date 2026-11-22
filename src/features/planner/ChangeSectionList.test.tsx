import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Course, Section } from '@/lib/domain/types';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { toSnapshot } from '@/lib/planner/transaction';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { ChangeSectionList } from './ChangeSectionList';

const t = createTranslator('th');

const QUERY: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '90000001',
};

const current = makeSection({
  teachTableId: 'c',
  section: '901',
  meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
});
const lecture = makeSection({
  teachTableId: 'l',
  section: '902',
  pairedSection: '932',
  meetings: [
    makeMeeting({
      day: 2,
      startMin: 540,
      endMin: 720,
      building: 'D',
      room: 'D-201',
    }),
  ],
  teachersTh: ['อ. ดร. จำปูน สำอาง', 'ผศ. ดร. มธุรดา จิตรวงศ์'],
  teachersEn: ['Dr. Champoon Sam-ang'],
  seats: { limit: 80, preCount: 0, queueLeft: 0, enrolled: 50 },
});
const practice = makeSection({
  teachTableId: 'p',
  section: '932',
  pairedSection: '902',
  kind: 'practice',
  // A second meeting from teachtime_str, and no place for an online class.
  meetings: [
    makeMeeting({ day: 4, startMin: 780, endMin: 900, kind: 'practice' }),
    makeMeeting({
      day: 5,
      startMin: 780,
      endMin: 900,
      kind: 'practice',
      building: '',
      room: '',
    }),
  ],
  teachersTh: ['อ. ดร. จำปูน สำอาง'],
  seats: { limit: null, preCount: 0, queueLeft: 0, enrolled: 3 },
});
const course = makeCourse({ sections: [current, lecture, practice] });

function entryOf(section: Section): PlanEntry {
  return makePlanEntry({ snapshot: toSnapshot(course, section) });
}

function seed(listed: Course[]): void {
  act(() => {
    seedActivePlan([entryOf(current)]);
    searchStore.setState({
      resultQuery: QUERY,
      result: {
        status: 'ready',
        data: {
          courses: listed,
          duplicateCount: 0,
          multiMeetingCount: 0,
          warnings: [],
        },
      },
    });
  });
}

function renderList(): void {
  const entry = planStore.getState().entries[0];
  if (entry === undefined) throw new Error('expected a placed entry');
  render(<ChangeSectionList entry={entry} locale="th" t={t} />);
}

// The instructor list of the one open choice, which carries no accessible name of its own.
function teacherList(): HTMLElement {
  const list = document.querySelector<HTMLElement>(
    '[data-teacher-scroll] > ul',
  );
  if (list === null) throw new Error('expected an instructor list');
  return list;
}

const toggle = () =>
  screen.getByRole('button', {
    name: `เปลี่ยนกลุ่มเรียน ${course.subjectId}`,
  });

afterEach(() => {
  cleanup();
  act(() => {
    resetPlanStore();
    searchStore.setState({ resultQuery: null, result: { status: 'idle' } });
  });
});

describe('ChangeSectionList', () => {
  it('opens on a list of the groups that fit, a pair as one choice', () => {
    seed([course]);
    renderList();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getByRole('list', {
      name: 'กลุ่มเรียนที่ว่างและไม่ชนกับตาราง',
    }).children;
    expect(options).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /^กลุ่มเรียน 902 .*กลุ่มเรียน 932/ }),
    ).toBeInTheDocument();
  });

  it('shows each part of a choice apart: section, meetings, places, seats, instructors', () => {
    seed([course]);
    renderList();
    fireEvent.click(toggle());
    const choice = screen.getByRole('button', { name: /^กลุ่มเรียน 902/ });
    // Each member reads its code, kind, every meeting with its place, and its seats, in
    // that order, and the pair's other half follows.
    expect(choice).toHaveAccessibleName(
      'กลุ่มเรียน 902 ทฤษฎี อ 09:00-12:00 D D-201 ว่าง 30 จาก 80 ' +
        'กลุ่มเรียน 932 ปฏิบัติ พฤ 13:00-15:00 A A101 ศ 13:00-15:00 ไม่จำกัดที่นั่ง',
    );
    // The instructors of both halves, each once, are a list the choice names as its
    // description, outside the button so the list can scroll on its own. The list has no
    // name of its own, which a browser would read as the description in place of its names
    // (jsdom ignores it, so the e2e focus walk checks the browser).
    const teachers = teacherList();
    expect(teachers).not.toHaveAttribute('aria-label');
    // Seats read in the catalog's tones, so a section with no seat limit is open green.
    expect(within(choice).getByText('ไม่จำกัดที่นั่ง').parentElement).toHaveClass(
      'text-success',
    );
    expect(choice).not.toContainElement(teachers);
    expect(
      [...teachers.querySelectorAll('li')].map((item) => item.textContent),
    ).toEqual(['อ. ดร. จำปูน สำอาง,', 'ผศ. ดร. มธุรดา จิตรวงศ์']);
    expect(choice).toHaveAccessibleDescription(
      'อ. ดร. จำปูน สำอาง, ผศ. ดร. มธุรดา จิตรวงศ์',
    );
    // jsdom lays nothing out, so the line fits: no region and no tab stop of its own.
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(teachers.parentElement).not.toHaveAttribute('tabindex');
  });

  it('makes an instructor line that holds more than it shows a tab stop', () => {
    const observers: ManualObserver[] = [];
    class ManualObserver implements ResizeObserver {
      constructor(readonly callback: ResizeObserverCallback) {
        observers.push(this);
      }
      fire(): void {
        this.callback([], this);
      }
      observe(): void {
        /* no layout in jsdom */
      }
      unobserve(): void {
        /* no layout in jsdom */
      }
      disconnect(): void {
        /* no layout in jsdom */
      }
    }
    const Original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ManualObserver;
    try {
      seed([course]);
      renderList();
      fireEvent.click(toggle());
      const scroller = teacherList().parentElement;
      if (scroller === null) throw new Error('expected the instructor line');
      Object.defineProperty(scroller, 'scrollWidth', { value: 400 });
      Object.defineProperty(scroller, 'clientWidth', { value: 200 });
      act(() => {
        for (const observer of observers) observer.fire();
      });
      // The region names its choice, so the landmarks of a long list stay apart.
      expect(screen.getByRole('region', { name: 'ผู้สอนกลุ่มเรียน 902, 932' })).toBe(
        scroller,
      );
      expect(scroller).toHaveAttribute('tabindex', '0');
      // Names past the end draw the fade and the ellipsis on the line.
      expect(scroller.parentElement).toHaveClass('kcp-more');
      // Scrolled to its end, the line drops the fade and stays a tab stop.
      Object.defineProperty(scroller, 'scrollLeft', { value: 200 });
      fireEvent.scroll(scroller);
      expect(scroller.parentElement).not.toHaveClass('kcp-more');
      expect(scroller).toHaveAttribute('tabindex', '0');
    } finally {
      globalThis.ResizeObserver = Original;
    }
  });

  it('lists the English names in English', () => {
    seed([course]);
    const entry = planStore.getState().entries[0];
    if (entry === undefined) throw new Error('expected a placed entry');
    render(
      <ChangeSectionList
        entry={entry}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: `Change section ${course.subjectId}`,
      }),
    );
    expect(teacherList()).toHaveTextContent('Dr. Champoon Sam-ang');
  });

  it('moves the subject in one undoable step and keeps focus on the toggle', () => {
    seed([course]);
    renderList();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: /^กลุ่มเรียน 902/ }));
    const placed = () =>
      planStore
        .getState()
        .entries.map((entry) => entry.section)
        .sort();
    expect(placed()).toEqual(['902', '932']);
    expect(planStore.getState().pendingUndo).toMatchObject({ kind: 'move' });
    expect(toggle()).toHaveFocus();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      planStore.getState().undo();
    });
    expect(placed()).toEqual(['901']);
  });

  it('says to search first when the catalog does not list the subject', () => {
    seed([]);
    renderList();
    fireEvent.click(toggle());
    expect(
      screen.getByText('ค้นหารายวิชานี้ในภาคการศึกษาของตารางก่อน จึงจะเปลี่ยนกลุ่มเรียนได้'),
    ).toBeInTheDocument();
  });

  it('says so when no other group fits', () => {
    seed([makeCourse({ sections: [current] })]);
    renderList();
    fireEvent.click(toggle());
    expect(
      screen.getByText('ไม่มีกลุ่มเรียนอื่นที่ว่างและไม่ชนกับตาราง'),
    ).toBeInTheDocument();
  });
});
