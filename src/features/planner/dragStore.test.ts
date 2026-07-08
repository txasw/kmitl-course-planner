import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { createDragStore } from './dragStore';

function clashingPlaced() {
  return [
    makeSection({
      teachTableId: 'p',
      subjectId: 'OTHER',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    }),
  ];
}

function draggedSection() {
  const section = makeSection({
    teachTableId: 'a',
    subjectId: 'S1',
    meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
  });
  const course = makeCourse({ subjectId: 'S1', sections: [section] });
  return { section, course };
}

describe('dragStore', () => {
  it('validates as valid when the section fits', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, []);
    expect(store.getState().active?.placement.ok).toBe(true);
  });

  it('validates as blocked against a conflicting placed section', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, clashingPlaced());
    expect(store.getState().active?.placement.ok).toBe(false);
  });

  it('rejects a blocked drop into blocked feedback', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, clashingPlaced());
    store.getState().reject();
    expect(store.getState().active).toBeNull();
    expect(store.getState().blocked?.conflicts.length).toBeGreaterThan(0);
  });

  it('clears a valid drag without feedback on reject', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, []);
    store.getState().reject();
    expect(store.getState().active).toBeNull();
    expect(store.getState().blocked).toBeNull();
  });
});
