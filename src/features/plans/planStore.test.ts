import { describe, it, expect } from 'vitest';
import type { SourceQuery } from '@/lib/domain/plan';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { createPlanStore } from './planStore';

const SOURCE_QUERY: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: {},
};

function courseFor(section: ReturnType<typeof makeSection>) {
  return makeCourse({ subjectId: section.subjectId, sections: [section] });
}

describe('planStore write side', () => {
  it('adds an addable section', () => {
    const store = createPlanStore();
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    const outcome = store
      .getState()
      .add(courseFor(section), section, SOURCE_QUERY);
    expect(outcome.ok).toBe(true);
    expect(store.getState().entries).toHaveLength(1);
  });

  it('does not add a section that conflicts with the plan', () => {
    const store = createPlanStore();
    const first = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    store.getState().add(courseFor(first), first, SOURCE_QUERY);
    const clashing = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    const outcome = store
      .getState()
      .add(courseFor(clashing), clashing, SOURCE_QUERY);
    expect(outcome.ok).toBe(false);
    expect(store.getState().entries).toHaveLength(1);
  });

  it('removes a section, holds it for undo, and restores it', () => {
    const store = createPlanStore();
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);

    store.getState().remove('a');
    expect(store.getState().entries).toHaveLength(0);
    expect(store.getState().pendingUndo).toHaveLength(1);

    store.getState().undoRemove();
    expect(store.getState().entries).toHaveLength(1);
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('clears the pending undo on the next add', () => {
    const store = createPlanStore();
    const first = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    store.getState().add(courseFor(first), first, SOURCE_QUERY);
    store.getState().remove('a');
    expect(store.getState().pendingUndo).not.toBeNull();

    const next = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 3 })],
    });
    store.getState().add(courseFor(next), next, SOURCE_QUERY);
    expect(store.getState().pendingUndo).toBeNull();
  });
});
