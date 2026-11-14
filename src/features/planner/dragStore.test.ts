import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { GridFrame } from '@/lib/planner/grid';
import { blockerIds, createDragStore, selectDragging } from './dragStore';

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

describe('frozen frame', () => {
  const frozen: GridFrame = {
    window: { startMin: 480, endMin: 1080 },
    days: [1, 2, 3, 4, 5],
  };

  it('holds no frame before any drag starts', () => {
    expect(createDragStore().getState().frame).toBeNull();
  });

  it('keeps the window unchanged for the length of a course drag', () => {
    const store = createDragStore();
    const { course, section } = draggedSection();
    store.getState().startCourse(course, []);
    store.getState().freezeFrame(frozen);
    // Raising a candidate, latching a swap, and showing a hint are all mid drag
    // updates; none of them may move the frame.
    store.getState().setRaised(section.teachTableId);
    store.getState().setSwapContext({
      incoming: section,
      course,
      originId: null,
      blockers: ['p'],
    });
    store.getState().setHint('hint');
    expect(store.getState().frame).toBe(frozen);
    store.getState().clearCourse();
    expect(store.getState().frame).toBeNull();
  });

  it('releases the frame when a section drag commits or rejects', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, []);
    store.getState().freezeFrame(frozen);
    store.getState().clearActive();
    expect(store.getState().frame).toBeNull();

    store.getState().start(course, section, clashingPlaced());
    store.getState().freezeFrame(frozen);
    store.getState().reject();
    expect(store.getState().frame).toBeNull();
  });

  it('releases the frame when a block move ends', () => {
    const store = createDragStore();
    const { section } = draggedSection();
    store.getState().startBlockMove(section, [section], null);
    store.getState().freezeFrame(frozen);
    expect(store.getState().frame).toBe(frozen);
    store.getState().clearBlockMove();
    expect(store.getState().frame).toBeNull();
  });
});

describe('rejecting', () => {
  function rejected() {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, clashingPlaced());
    store.getState().reject();
    return { store, section, course };
  }

  it('holds no footprint before any drop', () => {
    expect(createDragStore().getState().rejecting).toBeNull();
  });

  it('holds the rejected group once a blocked drop rejects', () => {
    const { store, section } = rejected();
    expect(store.getState().rejecting?.group).toEqual([section]);
    expect(store.getState().active).toBeNull();
  });

  it('holds nothing when a valid drag ends through reject', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, []);
    store.getState().reject();
    expect(store.getState().rejecting).toBeNull();
  });

  it('releases the footprint when the shake ends', () => {
    const { store } = rejected();
    store.getState().clearRejecting();
    expect(store.getState().rejecting).toBeNull();
    // The blocked reason outlives the shake in the strip.
    expect(store.getState().blocked).not.toBeNull();
  });

  it('releases the footprint when the next drag starts', () => {
    const first = rejected();
    first.store.getState().start(first.course, first.section, []);
    expect(first.store.getState().rejecting).toBeNull();

    const second = rejected();
    second.store.getState().startCourse(second.course, []);
    expect(second.store.getState().rejecting).toBeNull();

    const third = rejected();
    third.store.getState().startBlockMove(third.section, [third.section], null);
    expect(third.store.getState().rejecting).toBeNull();
  });

  it('releases the footprint when the blocked notice clears', () => {
    const cleared = rejected();
    cleared.store.getState().clearBlocked();
    expect(cleared.store.getState().rejecting).toBeNull();

    const dismissed = rejected();
    dismissed.store.getState().dismissNotice();
    expect(dismissed.store.getState().rejecting).toBeNull();
  });

  it('releases the footprint when another outcome replaces the strip', () => {
    const blocked = rejected();
    blocked.store.getState().showBlocked({
      course: blocked.course,
      section: blocked.section,
      conflicts: [],
    });
    expect(blocked.store.getState().rejecting).toBeNull();

    const crossTerm = rejected();
    crossTerm.store.getState().showCrossTerm({
      planTerm: { year: '2569', semester: '1' },
      incomingTerm: { year: '2569', semester: '2' },
    });
    expect(crossTerm.store.getState().rejecting).toBeNull();
  });
});

describe('showCrossTerm', () => {
  it('names both terms for a readable mismatch', () => {
    const store = createDragStore();
    store.getState().showCrossTerm({
      planTerm: { year: '2569', semester: '1' },
      incomingTerm: { year: '2569', semester: '2' },
    });
    expect(store.getState().crossTerm).toEqual({
      planTerm: { year: '2569', semester: '1' },
      browsedTerm: { year: '2569', semester: '2' },
    });
  });

  it('shows no switch strip when the incoming term is unreadable', () => {
    const store = createDragStore();
    store.getState().showCrossTerm({
      planTerm: { year: '2569', semester: '1' },
      incomingTerm: null,
    });
    expect(store.getState().crossTerm).toBeNull();
  });
});

describe('dismissNotice', () => {
  it('clears every visible notice and keeps the add line', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().showBlocked({ course, section, conflicts: [] });
    store.getState().setHint('hint');
    store.getState().announce('added');
    store.getState().dismissNotice();
    expect(store.getState().blocked).toBeNull();
    expect(store.getState().hint).toBeNull();
    expect(store.getState().announcement).toBe('added');
  });

  it('clears a cross term notice', () => {
    const store = createDragStore();
    store.getState().showCrossTerm({
      planTerm: { year: '2569', semester: '1' },
      incomingTerm: { year: '2569', semester: '2' },
    });
    store.getState().dismissNotice();
    expect(store.getState().crossTerm).toBeNull();
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

describe('selectDragging', () => {
  it('is false with no drag in flight', () => {
    expect(selectDragging(createDragStore().getState())).toBe(false);
  });

  it('is true during a section drag and false after it ends', () => {
    const store = createDragStore();
    const { section, course } = draggedSection();
    store.getState().start(course, section, []);
    expect(selectDragging(store.getState())).toBe(true);
    store.getState().clearActive();
    expect(selectDragging(store.getState())).toBe(false);
  });

  it('is true during a course drag and false after it ends', () => {
    const store = createDragStore();
    const { course } = draggedSection();
    store.getState().startCourse(course, []);
    expect(selectDragging(store.getState())).toBe(true);
    store.getState().clearCourse();
    expect(selectDragging(store.getState())).toBe(false);
  });

  it('is true during a block move and false after it ends', () => {
    const store = createDragStore();
    const { section } = draggedSection();
    store.getState().startBlockMove(section, [section], null);
    expect(selectDragging(store.getState())).toBe(true);
    store.getState().clearBlockMove();
    expect(selectDragging(store.getState())).toBe(false);
  });
});

type Store = ReturnType<typeof createDragStore>;

describe('hoverCourse', () => {
  it('holds and clears a previewed course', () => {
    const store = createDragStore();
    const { course } = draggedSection();
    store.getState().setHoverCourse(course);
    expect(store.getState().hoverCourse).toBe(course);
    store.getState().clearHoverCourse();
    expect(store.getState().hoverCourse).toBeNull();
  });

  it('clears only the matching subject when an id is given', () => {
    const store = createDragStore();
    const { course } = draggedSection();
    store.getState().setHoverCourse(course);
    store.getState().clearHoverCourse('OTHER');
    expect(store.getState().hoverCourse).toBe(course);
    store.getState().clearHoverCourse('S1');
    expect(store.getState().hoverCourse).toBeNull();
  });

  it.each([
    [
      'a section drag',
      (store: Store) => {
        const { section, course } = draggedSection();
        store.getState().start(course, section, []);
      },
    ],
    [
      'a course drag',
      (store: Store) => {
        store.getState().startCourse(draggedSection().course, []);
      },
    ],
    [
      'a block move',
      (store: Store) => {
        const { section } = draggedSection();
        store.getState().startBlockMove(section, [section], null);
      },
    ],
  ])('clears the preview when %s starts', (_label, startDrag) => {
    const store = createDragStore();
    store.getState().setHoverCourse(draggedSection().course);
    startDrag(store);
    expect(store.getState().hoverCourse).toBeNull();
  });

  it('ignores a preview while a drag is in flight', () => {
    const store = createDragStore();
    const { course } = draggedSection();
    store.getState().startCourse(course, []);
    store.getState().setHoverCourse(course);
    expect(store.getState().hoverCourse).toBeNull();
  });
});
