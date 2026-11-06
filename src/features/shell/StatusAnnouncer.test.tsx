import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { httpError } from '@/lib/utils/result';
import { searchStore, type QueryIntent } from '@/features/search/searchStore';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
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
