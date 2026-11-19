import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
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
  meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 720 })],
});
const practice = makeSection({
  teachTableId: 'p',
  section: '932',
  pairedSection: '902',
  kind: 'practice',
  meetings: [
    makeMeeting({ day: 4, startMin: 780, endMin: 900, kind: 'practice' }),
  ],
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
  render(<ChangeSectionList entry={entry} t={t} />);
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
    const options = screen.getAllByRole('listitem');
    expect(options).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /^กลุ่มเรียน 902 932/ }),
    ).toBeInTheDocument();
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
