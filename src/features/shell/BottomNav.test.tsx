import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import { dragStore } from '@/features/planner/dragStore';
import { searchStore } from '@/features/search/searchStore';
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
import { BottomNav } from './BottomNav';
import { uiStore } from './uiStore';

const catalog: NormalizedCatalog = {
  courses: ['90000001', '90000002', '90000003'].map((subjectId) =>
    makeCourse({
      subjectId,
      sections: [makeSection({ teachTableId: subjectId, subjectId })],
    }),
  ),
  duplicateCount: 0,
  multiMeetingCount: 0,
  warnings: [],
};

/** A plan entry for one section of a subject, so a pair can share its subject. */
function entry(subjectId: string, teachTableId: string) {
  return makePlanEntry({
    snapshot: makeSnapshot(makeSection({ subjectId, teachTableId })),
  });
}

function nav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'ส่วนของตัววางแผน' });
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  act(() => {
    dragStore.getState().clearBlockMove();
    searchStore.getState().setResult({ status: 'idle' }, null);
    uiStore.setState({ mobilePane: null, planView: 'timetable' });
    uiStore.getState().setLanguage('th');
  });
});

describe('BottomNav', () => {
  it('lists the catalog and both plan views as 56 px buttons in a nav landmark', () => {
    render(<BottomNav />);
    const items = within(nav()).getAllByRole('button');
    expect(items.map((item) => item.textContent)).toEqual([
      'รายวิชา',
      'ตารางเรียน',
      'ที่เลือก',
    ]);
    for (const item of items) expect(item).toHaveClass('min-h-14');
  });

  it('pads below its items by the bottom safe area inset', () => {
    render(<BottomNav />);
    expect(nav()).toHaveClass('pb-(--kcp-safe-bottom)');
  });

  it('opens on the catalog for an empty plan and marks it as the current pane', () => {
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: 'รายวิชา' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: 'ตารางเรียน' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('opens on the timetable when the plan has entries', () => {
    seedActivePlan([entry('90000001', 't1')]);
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: 'ตารางเรียน' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches panes and sets the plan view the item names', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'ที่เลือก' }));
    expect(uiStore.getState().mobilePane).toBe('plan');
    expect(uiStore.getState().planView).toBe('selected');
    const selected = screen.getByRole('button', { name: 'ที่เลือก' });
    expect(selected).toHaveAttribute('aria-current', 'page');
    expect(selected).toHaveClass('border-primary');

    fireEvent.click(screen.getByRole('button', { name: 'ตารางเรียน' }));
    expect(uiStore.getState().planView).toBe('timetable');

    fireEvent.click(screen.getByRole('button', { name: 'รายวิชา' }));
    expect(uiStore.getState().mobilePane).toBe('catalog');
    // The plan view waits for the return to the plan pane.
    expect(uiStore.getState().planView).toBe('timetable');
  });

  it('puts the result course count in the catalog item name', () => {
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    render(<BottomNav />);
    const item = screen.getByRole('button', { name: 'รายวิชา 3' });
    expect(item).toHaveTextContent('3');
  });

  it('counts placed subjects, not entries, in the selected item name', () => {
    seedActivePlan([
      entry('90000001', 't1'),
      entry('90000001', 't1p'),
      entry('90000002', 't2'),
    ]);
    render(<BottomNav />);
    expect(
      screen.getByRole('button', { name: 'ที่เลือก 2' }),
    ).toBeInTheDocument();
  });

  it('marks the timetable item with the review dot while a review is open', () => {
    const snapshot = makeSnapshot(
      makeSection({ subjectId: '90000001', teachTableId: 'r1' }),
    );
    seedActivePlan([
      makePlanEntry({
        snapshot,
        verifyStatus: 'changed',
        review: {
          kinds: ['time_changed'],
          before: snapshot,
          detectedAt: '2026-11-06T00:00:00.000Z',
          notifiedAt: null,
        },
      }),
      makePlanEntry({
        snapshot: makeSnapshot(
          makeSection({ subjectId: '90000002', teachTableId: 'm1' }),
        ),
        verifyStatus: 'missing',
      }),
    ]);
    render(<BottomNav />);
    // The dot's meaning is in the name, so it is not carried by colour alone.
    const timetable = screen.getByRole('button', {
      name: 'ตารางเรียน มีการเปลี่ยนแปลง 2 รายการ',
    });
    expect(timetable.querySelector('[data-review-dot]')).not.toBeNull();
    expect(nav().querySelectorAll('[data-review-dot]')).toHaveLength(1);
  });

  it('shows no review dot while nothing asks for review', () => {
    seedActivePlan([entry('90000001', 't1')]);
    render(<BottomNav />);
    expect(nav().querySelector('[data-review-dot]')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'ตารางเรียน' }),
    ).toBeInTheDocument();
  });

  it('labels the items in English', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<BottomNav />);
    expect(
      within(screen.getByRole('navigation', { name: 'Planner sections' }))
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Courses', 'Timetable', 'Selected']);
  });

  it('turns into the remove bar during a block drag and back after it', () => {
    const placed = makeSection({ teachTableId: 'b1', subjectId: '90000001' });
    render(
      <DndContext>
        <BottomNav />
      </DndContext>,
    );
    const items = within(nav()).getAllByRole('button');
    const group = items[0]?.parentElement;
    expect(nav().querySelector('[data-remove-zone]')).toBeNull();

    act(() => {
      dragStore.getState().startBlockMove(placed, [placed], null);
    });
    const bar = nav().querySelector('[data-remove-zone="bar"]');
    expect(bar).toHaveClass('absolute', 'bottom-0', 'pb-(--kcp-safe-bottom)');
    expect(bar).toHaveTextContent('วางที่นี่เพื่อนำออกจากตาราง');
    expect(group).toHaveClass('invisible');
    expect(group).toHaveAttribute('inert');

    act(() => {
      dragStore.getState().clearBlockMove();
    });
    expect(nav().querySelector('[data-remove-zone]')).toBeNull();
    expect(group).not.toHaveClass('invisible');
    expect(group).not.toHaveAttribute('inert');
  });
});
