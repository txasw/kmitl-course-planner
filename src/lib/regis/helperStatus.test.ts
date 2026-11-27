import { describe, expect, it } from 'vitest';
import type { Checklist, ChecklistRow, RowState } from './checklist';
import {
  addForMeBlock,
  advanceCurrent,
  deriveHelperStatuses,
  doneCount,
  focusOnSettle,
  needsLook,
  pickCurrent,
  sentCount,
  showsHandOff,
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

  // Owner answer A2, 2026-11-27: on the complete step each subject reads on its own, so a
  // planned subject missing from the submitted list no longer reads as submitted.
  it('reads each subject from the submitted list on its own', () => {
    const { statuses, sent } = derive({
      list: checklist(
        row('A', 'submitted'),
        row('B', 'notSubmitted'),
        row('C', 'granted'),
        row('D', 'notGranted'),
        row('E', 'notGrantedCondition'),
      ),
      adding: 'B',
      stop: { subjectId: 'B', reason: 'full' },
    });
    // No announced result has been seen live, so each still reads as waiting.
    expect(statuses).toEqual({
      A: 'sent',
      B: 'notSent',
      C: 'sent',
      D: 'sent',
      E: 'sent',
    });
    expect(sent).toBe(true);
    expect(sentCount(statuses)).toBe(4);
  });

  it('reads every subject as not sent when the list holds none of the plan', () => {
    const { statuses, sent } = derive({
      list: checklist(row('A', 'notSubmitted'), row('B', 'notSubmitted')),
    });
    expect(statuses).toEqual({ A: 'notSent', B: 'notSent' });
    expect(sent).toBe(true);
    expect(sentCount(statuses)).toBe(0);
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

  describe('focusOnSettle', () => {
    // Add all names A and B; X, refused earlier, sits between them in plan order.
    const runOrder = ['A', 'X', 'B'];
    const settled = { A: 'added', X: 'refused', B: 'todo' } as const;

    it('pins the next subject that needs action once the focus settles', () => {
      expect(
        focusOnSettle({
          order: runOrder,
          statuses: settled,
          current: 'A',
          was: 'adding',
          runLeads: false,
        }),
      ).toBe('X');
    });

    it('pins nothing while a run with no subject pinned leads the focus', () => {
      expect(
        focusOnSettle({
          order: runOrder,
          statuses: settled,
          current: 'A',
          was: 'adding',
          runLeads: true,
        }),
      ).toBeNull();
    });

    it('pins nothing for a subject that was already settled or has no reading', () => {
      const input = {
        order: runOrder,
        statuses: settled,
        current: 'A',
        runLeads: false,
      };
      expect(focusOnSettle({ ...input, was: 'added' })).toBeNull();
      expect(focusOnSettle({ ...input, was: undefined })).toBeNull();
      expect(
        focusOnSettle({ ...input, current: null, was: 'todo' }),
      ).toBeNull();
      expect(focusOnSettle({ ...input, current: 'B', was: 'todo' })).toBeNull();
    });
  });
});

describe('addForMeBlock', () => {
  const ready: AddFacts = {
    onPage: true,
    available: true,
    checking: false,
    off: false,
    target: true,
    kitStale: false,
    stale: false,
    termMismatch: false,
    inStep: true,
    busy: false,
    preparing: false,
  };

  it('allows add for me only when every condition holds', () => {
    expect(addForMeBlock(ready)).toBeNull();
  });

  it('names another page before any other reason, the host check included', () => {
    const blocked: AddFacts = {
      onPage: false,
      available: false,
      checking: true,
      off: true,
      preparing: true,
      target: false,
      kitStale: true,
      stale: true,
      termMismatch: true,
      inStep: false,
      busy: true,
    };
    expect(addForMeBlock(blocked)).toBe('otherPage');
    expect(addForMeBlock({ ...ready, onPage: false })).toBe('otherPage');
    expect(
      addForMeBlock({
        ...ready,
        onPage: false,
        available: false,
        checking: true,
      }),
    ).toBe('otherPage');
  });

  it('reads the host check as checking only on the pre registration page', () => {
    const pending = { ...ready, available: false, checking: true };
    expect(addForMeBlock(pending)).toBe('checking');
    expect(addForMeBlock({ ...pending, onPage: false })).toBe('otherPage');
  });

  it('names the first reason that applies', () => {
    expect(
      addForMeBlock({ ...ready, available: false, stale: true, busy: true }),
    ).toBe('unavailable');
    expect(
      addForMeBlock({ ...ready, available: false, checking: true, off: true }),
    ).toBe('checking');
    expect(addForMeBlock({ ...ready, off: true, stale: true })).toBe('off');
    expect(addForMeBlock({ ...ready, target: false })).toBe('noKit');
    expect(addForMeBlock({ ...ready, target: false, kitStale: true })).toBe(
      'kitStale',
    );
    expect(
      addForMeBlock({
        ...ready,
        target: false,
        kitStale: true,
        preparing: true,
      }),
    ).toBe('preparing');
    expect(addForMeBlock({ ...ready, target: false, preparing: true })).toBe(
      'preparing',
    );
    expect(addForMeBlock({ ...ready, preparing: true })).toBe('preparing');
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

  it('names a subject a request of the page stopped on, from the first not added', () => {
    // A run of A, B, and C added A, then the page's own request stopped it on B.
    const list = checklist(
      row('A', 'added'),
      row('B', 'notDone'),
      row('C', 'notDone'),
    );
    const { statuses } = derive({
      list,
      stop: { subjectId: 'B', reason: 'pageRequest' },
    });
    expect(statuses).toEqual({ A: 'added', B: 'todo', C: 'todo' });
    expect(stillToAdd(['A', 'B', 'C'], statuses)).toEqual(['B', 'C']);
  });
});

describe('showsHandOff', () => {
  const facts = {
    onPage: true,
    stale: false,
    sent: false,
    running: false,
    statuses: { A: 'added', B: 'other', C: 'cond' },
  } as const;

  it('shows once the page lists every planned subject on pre registration', () => {
    expect(showsHandOff(facts)).toBe(true);
  });

  it('stays hidden in every other state', () => {
    expect(
      showsHandOff({ ...facts, statuses: { A: 'added', B: 'todo' } }),
    ).toBe(false);
    expect(
      showsHandOff({ ...facts, statuses: { A: 'added', B: 'full' } }),
    ).toBe(false);
    expect(showsHandOff({ ...facts, statuses: {} })).toBe(false);
    expect(showsHandOff({ ...facts, onPage: false })).toBe(false);
    expect(showsHandOff({ ...facts, stale: true })).toBe(false);
    expect(showsHandOff({ ...facts, sent: true })).toBe(false);
    expect(showsHandOff({ ...facts, running: true })).toBe(false);
  });
});
