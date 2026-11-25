import { describe, expect, it } from 'vitest';
import type { Checklist, ChecklistRow, RowState } from './checklist';
import {
  addForMeBlock,
  advanceCurrent,
  deriveHelperStatuses,
  doneCount,
  needsLook,
  pickCurrent,
  stillToAdd,
  type AddFacts,
  type HelperInput,
} from './helperStatus';

// The helper reads each subject's status from the page and the student's fill run only.

function row(subjectId: string, state: RowState): ChecklistRow {
  return {
    subjectId,
    nameTh: '',
    nameEn: '',
    credit: 3,
    planned: [],
    alternatives: [],
    state,
    observed: null,
    chosen: null,
    conditionsTh: [],
    conditionsEn: [],
    duplicateCode: null,
    missing: false,
    plannedSeat: null,
  };
}

function checklist(...rows: ChecklistRow[]): Checklist {
  return {
    term: { year: '2569', semester: '1' },
    termMismatch: false,
    hasKit: true,
    rows,
    extras: [],
    listedPlanned: 0,
    total: rows.length,
  };
}

function derive(patch: Partial<HelperInput> & { list: Checklist }) {
  const { list, ...rest } = patch;
  return deriveHelperStatuses({
    checklist: list,
    stale: false,
    last: {},
    adding: null,
    stop: null,
    ...rest,
  });
}

describe('deriveHelperStatuses', () => {
  it('maps what the page shows for each subject', () => {
    const { statuses, sent } = derive({
      list: checklist(
        row('A', 'notDone'),
        row('B', 'added'),
        row('C', 'addedOther'),
        row('D', 'conditional'),
        row('E', 'refused'),
        row('F', 'termMismatch'),
      ),
    });
    expect(statuses).toEqual({
      A: 'todo',
      B: 'added',
      C: 'other',
      D: 'cond',
      E: 'refused',
      F: 'todo',
    });
    expect(sent).toBe(false);
  });

  it('reads every subject as sent once the page shows the submitted list', () => {
    const { statuses, sent } = derive({
      list: checklist(row('A', 'granted'), row('B', 'notDone')),
      adding: 'B',
    });
    expect(statuses).toEqual({ A: 'sent', B: 'sent' });
    expect(sent).toBe(true);
  });

  it('shows the subject a run is adding before what the page shows', () => {
    const { statuses } = derive({
      list: checklist(row('A', 'notDone'), row('B', 'notDone')),
      adding: 'A',
    });
    expect(statuses).toEqual({ A: 'adding', B: 'todo' });
  });

  it('keeps the last known statuses while the page cannot be read', () => {
    const { statuses } = derive({
      list: checklist(row('A', 'notDone'), row('B', 'notDone')),
      stale: true,
      last: { A: 'added' },
    });
    expect(statuses).toEqual({ A: 'added', B: 'todo' });
  });

  it('names a fill stop the page caused on a subject still to add', () => {
    const list = checklist(row('A', 'notDone'), row('B', 'added'));
    for (const [reason, status] of [
      ['full', 'full'],
      ['refused', 'refused'],
      ['hostClash', 'clash'],
      ['kcpClash', 'clash'],
      ['fieldNotEmpty', 'todo'],
    ] as const) {
      expect(
        derive({ list, stop: { subjectId: 'A', reason } }).statuses.A,
      ).toBe(status);
    }
    // The page listing the subject outranks the stop.
    expect(
      derive({ list, stop: { subjectId: 'B', reason: 'full' } }).statuses.B,
    ).toBe('added');
  });
});

describe('the focus and the counts', () => {
  const order = ['A', 'B', 'C', 'D'];
  const statuses = {
    A: 'added',
    B: 'cond',
    C: 'todo',
    D: 'clash',
  } as const;

  it('counts the settled subjects and flags a turned down one', () => {
    expect(doneCount(statuses)).toBe(2);
    expect(needsLook(statuses)).toBe(true);
    expect(needsLook({ A: 'added', B: 'todo' })).toBe(false);
  });

  it('opens on the first subject that still needs action', () => {
    expect(pickCurrent(order, statuses)).toBe('C');
    expect(pickCurrent(['A'], { A: 'added' })).toBe('A');
    expect(pickCurrent([], {})).toBeNull();
  });

  it('moves on from a subject that settles, wrapping round', () => {
    expect(advanceCurrent(order, statuses, 'A')).toBe('C');
    expect(advanceCurrent(order, { ...statuses, C: 'added' }, 'C')).toBe('D');
    expect(advanceCurrent(order, { ...statuses, D: 'other' }, 'D')).toBe('C');
    expect(advanceCurrent(order, statuses, 'C')).toBe('C');
    expect(advanceCurrent(['A'], { A: 'added' }, 'A')).toBe('A');
  });
});

describe('addForMeBlock', () => {
  const ready: AddFacts = {
    available: true,
    off: false,
    target: true,
    stale: false,
    termMismatch: false,
    inStep: true,
    busy: false,
  };

  it('allows add for me only when every condition holds', () => {
    expect(addForMeBlock(ready)).toBeNull();
  });

  it('names the first reason that applies', () => {
    expect(
      addForMeBlock({ ...ready, available: false, stale: true, busy: true }),
    ).toBe('unavailable');
    expect(addForMeBlock({ ...ready, off: true, stale: true })).toBe('off');
    expect(addForMeBlock({ ...ready, target: false })).toBe('noKit');
    expect(addForMeBlock({ ...ready, stale: true, inStep: false })).toBe(
      'stale',
    );
    expect(addForMeBlock({ ...ready, termMismatch: true })).toBe(
      'termMismatch',
    );
    expect(addForMeBlock({ ...ready, inStep: false, busy: true })).toBe(
      'notInStep',
    );
    expect(addForMeBlock({ ...ready, busy: true })).toBe('busy');
  });
});

describe('stillToAdd', () => {
  it('names the subjects not added and not turned down, in plan order', () => {
    expect(
      stillToAdd(['A', 'B', 'C', 'D', 'E', 'F'], {
        A: 'added',
        B: 'todo',
        C: 'full',
        D: 'clash',
        F: 'todo',
      }),
    ).toEqual(['B', 'E', 'F']);
    expect(stillToAdd(['A'], { A: 'adding' })).toEqual([]);
  });
});
