import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { httpError } from '@/lib/utils/result';
import type { PlanEntry } from '@/lib/domain/plan';
import { planStore } from '@/features/plans/planStore';
import { searchStore, type QueryIntent } from '@/features/search/searchStore';
import {
  revalidationStore,
  type RevalidationRun,
} from '@/features/plans/revalidationStore';
import {
  makeCourse,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { StatusAnnouncer } from './StatusAnnouncer';
import { uiStore } from './uiStore';

const query: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '2',
  search_all_faculty: true,
  selected_subject_owner_id: '32',
};

function catalog(sectionsPerCourse: number[]): NormalizedCatalog {
  return {
    courses: sectionsPerCourse.map((count, course) =>
      makeCourse({
        subjectId: `9000000${String(course)}`,
        sections: Array.from({ length: count }, (_, section) =>
          makeSection({ teachTableId: `${String(course)}-${String(section)}` }),
        ),
      }),
    ),
    duplicateCount: 0,
    multiMeetingCount: 0,
    warnings: [],
  };
}

function run(
  intent: QueryIntent,
  settle: Parameters<ReturnType<typeof searchStore.getState>['setResult']>[0],
): void {
  act(() => {
    searchStore.getState().startQuery(query, intent);
  });
  act(() => {
    searchStore.getState().setResult(settle, query);
  });
}

function region(): HTMLElement {
  return screen.getByRole('status');
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  act(() => {
    searchStore.getState().cancelSearch();
    uiStore.getState().setLanguage('th');
  });
});

describe('StatusAnnouncer', () => {
  it('starts empty', () => {
    render(<StatusAnnouncer />);
    expect(region()).toBeEmptyDOMElement();
  });

  it('names the course and section count when a user search settles', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([1, 3]) });
    expect(region()).toHaveTextContent('พบ 2 รายวิชา 4 กลุ่มเรียน');
  });

  it('names the empty title with the searched term', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([]) });
    expect(region()).toHaveTextContent('ไม่พบรายวิชา ภาคการศึกษา 2/2569');
  });

  it('names the error title when a user search fails', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'error', error: httpError(500, 'boom') });
    expect(region()).toHaveTextContent('โหลดรายวิชาไม่สำเร็จ');
  });

  it('says nothing while the search runs', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([1]) });
    act(() => {
      searchStore.getState().startQuery(query, 'user');
    });
    expect(region()).toBeEmptyDOMElement();
  });

  it('does not announce a background refresh', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([1]) });
    run('background', { status: 'ready', data: catalog([2]) });
    expect(region()).toBeEmptyDOMElement();
  });

  it('names the outcome of a retry pressed on the error state', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'error', error: httpError(500, 'boom') });
    run('background', { status: 'ready', data: catalog([2]) });
    expect(region()).toHaveTextContent('พบ 1 รายวิชา 2 กลุ่มเรียน');
  });

  it('names the error again when a retry fails again', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'error', error: httpError(500, 'boom') });
    const first = region().firstElementChild;
    run('background', { status: 'error', error: httpError(503, 'down') });
    expect(region().firstElementChild).not.toBe(first);
    expect(region()).toHaveTextContent('โหลดรายวิชาไม่สำเร็จ');
  });

  it('says nothing when a running search is cancelled', () => {
    render(<StatusAnnouncer />);
    act(() => {
      searchStore.getState().startQuery(query, 'user');
    });
    act(() => {
      searchStore.getState().cancelSearch();
    });
    expect(region()).toBeEmptyDOMElement();
  });

  it('does not repeat an outcome on a re-render or a language change', () => {
    const { rerender } = render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([1]) });
    const message = region().firstElementChild;
    rerender(<StatusAnnouncer />);
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(region().firstElementChild).toBe(message);
    expect(region()).toHaveTextContent('พบ 1 รายวิชา 1 กลุ่มเรียน');
  });

  it('does not replay an outcome when it mounts again', () => {
    const { unmount } = render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([1]) });
    unmount();
    render(<StatusAnnouncer />);
    expect(region()).toBeEmptyDOMElement();
  });

  it('reads a repeated search with the same outcome as a new message', () => {
    render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([1]) });
    const first = region().firstElementChild;
    run('user', { status: 'ready', data: catalog([1]) });
    expect(region().firstElementChild).not.toBe(first);
    expect(region()).toHaveTextContent('พบ 1 รายวิชา 1 กลุ่มเรียน');
  });

  it('speaks in the current language', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<StatusAnnouncer />);
    run('user', { status: 'ready', data: catalog([2, 2]) });
    expect(region()).toHaveTextContent('Found 2 courses and 4 sections');
  });
});

describe('StatusAnnouncer plan checks', () => {
  const report = {
    summary: { total: 1, unchanged: 0, changed: 1, missing: 0 },
    entries: [],
    termFindings: [],
  };

  function check(manual: boolean, settle: RevalidationRun): void {
    act(() => {
      revalidationStore
        .getState()
        .setRun('p1', { status: 'running', report: null, manual });
    });
    act(() => {
      revalidationStore.getState().setRun('p1', { ...settle, manual });
    });
  }

  afterEach(() => {
    resetPlanStore();
    revalidationStore.setState({ runs: {} });
  });

  it('names the status line when a manual check settles', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ lastVerifiedAt: null })], { id: 'p1' });
    });
    render(<StatusAnnouncer />);
    check(true, { status: 'offline', report: null });
    expect(region()).toHaveTextContent(
      'ยังตรวจสอบไม่ได้ แสดงข้อมูลที่บันทึกไว้',
    );
  });

  it('names the changes a manual check found', () => {
    act(() => {
      seedActivePlan(
        [makePlanEntry({ lastVerifiedAt: new Date().toISOString() })],
        { id: 'p1' },
      );
    });
    render(<StatusAnnouncer />);
    check(true, { status: 'done', report });
    expect(region()).toHaveTextContent(/^ตรวจสอบแล้ว \d\d:\d\d เปลี่ยน 1$/);
  });

  it('says nothing when an automatic check settles', () => {
    act(() => {
      seedActivePlan([makePlanEntry()], { id: 'p1' });
    });
    render(<StatusAnnouncer />);
    check(false, { status: 'done', report });
    expect(region()).toBeEmptyDOMElement();
  });
});

/** A placed entry, with an open room review when asked for. */
function entry(id: string, review = false): PlanEntry {
  const snapshot = makeSnapshot({
    teachTableId: id,
    subjectId: `9000000${id}`,
  });
  return makePlanEntry({
    snapshot,
    verifyStatus: review ? 'changed' : 'verified',
    ...(review
      ? {
          review: {
            kinds: ['room_changed'],
            before: snapshot,
            detectedAt: '2026-11-06T00:00:00.000Z',
            notifiedAt: null,
          },
        }
      : {}),
  });
}

/** Replace the active plan's entries, the way a check records its outcome. */
function record(entries: PlanEntry[]): void {
  act(() => {
    planStore.setState({ entries });
  });
}

describe('StatusAnnouncer and the updates indicator', () => {
  it('reads the indicator once when a check first records changes', () => {
    seedActivePlan([entry('1'), entry('2')]);
    render(<StatusAnnouncer />);
    record([entry('1', true), entry('2')]);
    const message = region().firstElementChild;
    expect(region()).toHaveTextContent('มีการเปลี่ยนแปลง 1 รายการ');

    record([entry('1', true), entry('2', true)]);
    expect(region().firstElementChild).toBe(message);
    expect(region()).toHaveTextContent('มีการเปลี่ยนแปลง 1 รายการ');
  });

  it('reads it again when it returns after every item was reviewed', () => {
    seedActivePlan([entry('1')]);
    render(<StatusAnnouncer />);
    record([entry('1', true)]);
    const first = region().firstElementChild;
    record([entry('1')]);
    record([entry('1', true)]);
    expect(region().firstElementChild).not.toBe(first);
    expect(region()).toHaveTextContent('มีการเปลี่ยนแปลง 1 รายการ');
  });

  it('says nothing for a plan that already had items when it mounted', () => {
    seedActivePlan([entry('1', true)]);
    render(<StatusAnnouncer />);
    record([entry('1', true), entry('2', true)]);
    expect(region()).toBeEmptyDOMElement();
  });
});
