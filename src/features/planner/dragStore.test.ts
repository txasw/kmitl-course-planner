import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { blockerIds, createDragStore } from './dragStore';

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

  it('surfaces a blocked feedback from a non-drag add', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().showBlocked({
      course,
      section,
      conflicts: [
        {
          kind: 'time',
          blocking: { teachTableId: 'p', subjectId: 'X', section: '900' },
          day: 1,
          startMin: 540,
          endMin: 600,
        },
      ],
    });
    expect(store.getState().active).toBeNull();
    expect(store.getState().blocked?.conflicts.length).toBeGreaterThan(0);
  });

  it('starts and clears a course drag with its candidates', () => {
    const store = createDragStore();
    const { course } = draggedSection();
    store.getState().startCourse(course, []);
    expect(store.getState().courseDrag?.candidates).toHaveLength(1);
    expect(store.getState().courseDrag?.candidates[0]?.valid).toBe(true);
    store.getState().clearCourse();
    expect(store.getState().courseDrag).toBeNull();
  });

  it('starts a block move with the subject other sections as candidates', () => {
    const store = createDragStore();
    const dragged = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const other = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 600 })],
    });
    const course = makeCourse({ subjectId: 'S1', sections: [dragged, other] });
    store.getState().startBlockMove(dragged, [dragged], course);
    const candidates = store.getState().blockMove?.candidates ?? [];
    // Only the other section is a candidate; the dragged 901 is excluded.
    expect(candidates.map((candidate) => candidate.section.section)).toEqual([
      '902',
    ]);
    expect(candidates[0]?.valid).toBe(true);
  });

  it('starts a block move with no candidates when the course is absent', () => {
    const store = createDragStore();
    const dragged = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    store.getState().startBlockMove(dragged, [dragged], null);
    expect(store.getState().blockMove?.course).toBeNull();
    expect(store.getState().blockMove?.candidates).toHaveLength(0);
  });

  it('clears any other live drag when a block move starts', () => {
    const store = createDragStore();
    const { course, section } = draggedSection();
    store.getState().startCourse(course, []);
    store.getState().startBlockMove(section, [section], null);
    expect(store.getState().courseDrag).toBeNull();
    expect(store.getState().active).toBeNull();
    store.getState().clearBlockMove();
    expect(store.getState().blockMove).toBeNull();
  });

  it('latches a swap context on a blocked section drag', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, clashingPlaced());
    const swap = store.getState().swapContext;
    expect(swap?.incoming.subjectId).toBe('S1');
    expect(swap?.originId).toBeNull();
    expect(swap?.blockers).toEqual(['p']);
  });

  it('leaves no swap context on a valid section drag', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, []);
    expect(store.getState().swapContext).toBeNull();
  });

  it('clears the swap context when a blocked drag rejects', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, clashingPlaced());
    store.getState().reject();
    expect(store.getState().swapContext).toBeNull();
  });
});

describe('blockerIds', () => {
  it('collects the distinct blocking teachTableIds', () => {
    expect(
      blockerIds([
        {
          kind: 'time',
          blocking: { teachTableId: 'p', subjectId: 'X', section: '900' },
          day: 1,
          startMin: 540,
          endMin: 600,
        },
        {
          kind: 'time',
          blocking: { teachTableId: 'p', subjectId: 'X', section: '900' },
          day: 2,
          startMin: 540,
          endMin: 600,
        },
        {
          kind: 'duplicate',
          blocking: { teachTableId: 'q', subjectId: 'S1', section: '901' },
          subjectId: 'S1',
        },
      ]),
    ).toEqual(['p', 'q']);
  });
});
