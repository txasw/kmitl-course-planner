import { describe, expect, it } from 'vitest';
import { makeSection } from '../../../tests/support/domain-builders';
import type { ConflictDetail } from '../planner/placement';
import type { SectionRelation } from '../planner/sectionState';
import {
  computeRowStatus,
  isConflictStatus,
  type RowStatus,
} from './rowStatus';
import { computeSeatStatus, type SeatStatus } from './seatStatus';

const blocking = { teachTableId: '1', subjectId: '90000001', section: '901' };
const time: ConflictDetail = {
  kind: 'time',
  blocking,
  day: 1,
  startMin: 540,
  endMin: 600,
};
const exam: ConflictDetail = {
  kind: 'exam',
  blocking,
  examKind: 'midterm',
  self: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
  other: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
};

const RELATIONS: Record<string, SectionRelation> = {
  different_term: {
    kind: 'different_term',
    planTerm: { year: '2569', semester: '1' },
    browsedTerm: { year: '2569', semester: '2' },
  },
  added: { kind: 'added' },
  duplicate: { kind: 'duplicate', subjectId: '90000001' },
  time_conflict: { kind: 'conflicting', conflicts: [exam, time] },
  exam_clash: { kind: 'conflicting', conflicts: [exam] },
  addable: { kind: 'addable' },
};

const SEATS: Record<'closed' | 'full' | 'open', SeatStatus> = {
  closed: { kind: 'closed' },
  full: { kind: 'full' },
  open: { kind: 'open', remaining: 12 },
};

// The precedence the badge follows, highest first. Every pair of statuses that can
// meet on one row is checked below: the relation kinds are exclusive of each other,
// so a pair meets either across the relation and the seat, or within the conflicts.
const PRECEDENCE: RowStatus[] = [
  'different_term',
  'closed',
  'full',
  'added',
  'duplicate',
  'time_conflict',
  'exam_clash',
];

function expected(
  relation: string,
  seat: keyof typeof SEATS,
): RowStatus | null {
  const candidates = [relation, seat].filter((status): status is RowStatus =>
    PRECEDENCE.some((ranked) => ranked === status),
  );
  const ranked = candidates.sort(
    (a, b) => PRECEDENCE.indexOf(a) - PRECEDENCE.indexOf(b),
  );
  return ranked[0] ?? null;
}

describe('computeRowStatus', () => {
  for (const [relationName, relation] of Object.entries(RELATIONS)) {
    for (const seatName of ['closed', 'full', 'open'] as const) {
      it(`resolves ${relationName} with a ${seatName} seat`, () => {
        expect(computeRowStatus(relation, SEATS[seatName])).toBe(
          expected(relationName, seatName),
        );
      });
    }
  }

  it('lets a different term outrank a closed and a full seat', () => {
    const relation = RELATIONS.different_term;
    if (relation === undefined) {
      throw new Error('missing relation');
    }
    expect(computeRowStatus(relation, SEATS.closed)).toBe('different_term');
    expect(computeRowStatus(relation, SEATS.full)).toBe('different_term');
  });

  it('suppresses every plan verdict on a closed or full section', () => {
    for (const relation of [
      RELATIONS.added,
      RELATIONS.duplicate,
      RELATIONS.time_conflict,
      RELATIONS.exam_clash,
    ]) {
      if (relation === undefined) {
        throw new Error('missing relation');
      }
      expect(computeRowStatus(relation, SEATS.closed)).toBe('closed');
      expect(computeRowStatus(relation, SEATS.full)).toBe('full');
    }
  });

  it('reads closed over full when a closed section also reports full', () => {
    const closedAndFull = makeSection({
      isClosed: true,
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    expect(
      computeRowStatus({ kind: 'addable' }, computeSeatStatus(closedAndFull)),
    ).toBe('closed');
  });

  it('reads a time conflict when a time clash sits among exam clashes', () => {
    expect(
      computeRowStatus(
        { kind: 'conflicting', conflicts: [exam, time, exam] },
        SEATS.open,
      ),
    ).toBe('time_conflict');
  });

  it('reads an exam clash only when every conflict is an exam overlap', () => {
    expect(
      computeRowStatus(
        {
          kind: 'conflicting',
          conflicts: [exam, { ...exam, examKind: 'final' }],
        },
        SEATS.open,
      ),
    ).toBe('exam_clash');
  });

  it('reads a time conflict for a conflicting relation with no details', () => {
    expect(
      computeRowStatus({ kind: 'conflicting', conflicts: [] }, SEATS.open),
    ).toBe('time_conflict');
  });

  it('gives an addable open section no status', () => {
    expect(computeRowStatus({ kind: 'addable' }, SEATS.open)).toBeNull();
    expect(
      computeRowStatus({ kind: 'addable' }, { kind: 'open', remaining: null }),
    ).toBeNull();
  });
});

describe('isConflictStatus', () => {
  it('holds for a time conflict and an exam clash only', () => {
    expect(isConflictStatus('time_conflict')).toBe(true);
    expect(isConflictStatus('exam_clash')).toBe(true);
    for (const status of PRECEDENCE.slice(0, 5)) {
      expect(isConflictStatus(status)).toBe(false);
    }
    expect(isConflictStatus(null)).toBe(false);
  });

  it('is false for a conflicting relation on a full or closed seat', () => {
    const relation = RELATIONS.time_conflict;
    if (relation === undefined) {
      throw new Error('missing relation');
    }
    expect(isConflictStatus(computeRowStatus(relation, SEATS.full))).toBe(
      false,
    );
    expect(isConflictStatus(computeRowStatus(relation, SEATS.closed))).toBe(
      false,
    );
  });
});
