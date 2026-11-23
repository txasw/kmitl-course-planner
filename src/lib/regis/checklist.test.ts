import { describe, it, expect } from 'vitest';
import type { NormalizedCatalog } from '../domain/normalize';
import type { Course, Section } from '../domain/types';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toSnapshot } from '../planner/transaction';
import { buildRegistrationKit } from './kit';
import { deriveChecklist } from './checklist';
import { sectionChoicesSchema, withChoice } from './choices';

function catalogOf(...courses: Course[]): NormalizedCatalog {
  return { courses, duplicateCount: 0, multiMeetingCount: 0, warnings: [] };
}

function entryFor(course: Course, section: Section) {
  return makePlanEntry({ snapshot: toSnapshot(course, section) });
}

const A1 = makeSection({
  teachTableId: 'A1',
  subjectId: 'A',
  section: '1',
  meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
});
const A2 = makeSection({
  teachTableId: 'A2',
  subjectId: 'A',
  section: '2',
  meetings: [makeMeeting({ day: 3, startMin: 780, endMin: 960 })],
});
const A3 = makeSection({
  teachTableId: 'A3',
  subjectId: 'A',
  section: '3',
  meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 660 })],
});
const COURSE_A = makeCourse({ subjectId: 'A', sections: [A1, A2, A3] });
const B1 = makeSection({
  teachTableId: 'B1',
  subjectId: 'B',
  section: '1',
  meetings: [makeMeeting({ day: 3, startMin: 780, endMin: 900 })],
});
const COURSE_B = makeCourse({
  subjectId: 'B',
  credit: 1,
  sections: [B1],
});

const plan = makePlan({
  entries: [entryFor(COURSE_A, A1), entryFor(COURSE_B, B1)],
});
const kit = buildRegistrationKit({
  plan,
  results: new Map([
    ['A', catalogOf(COURSE_A)],
    ['B', catalogOf(COURSE_B)],
  ]),
  preparedAt: '2026-11-22T14:10:00.000Z',
});

describe('deriveChecklist', () => {
  it('lists every planned subject as not done until the page lists it', () => {
    const list = deriveChecklist({ plan, kit, choices: null, pageTerm: null });
    expect(list.rows.map((row) => [row.subjectId, row.state])).toEqual([
      ['A', 'notDone'],
      ['B', 'notDone'],
    ]);
    expect(list).toMatchObject({ done: 0, total: 2, credits: 4, hasKit: true });
  });

  it('orders the other sections fitting first, then by start', () => {
    const row = deriveChecklist({ plan, kit, choices: null, pageTerm: null })
      .rows[0];
    // A2 clashes with B on Wednesday afternoon; A3 fits on Tuesday.
    expect(
      row?.alternatives.map((option) => [option.ids[0], option.fit]),
    ).toEqual([
      ['A3', 'fits'],
      ['A2', 'time'],
    ]);
  });

  it('resolves the section the student chose for this registration', () => {
    const choices = withChoice(null, plan, 'A', ['A3']);
    const row = deriveChecklist({ plan, kit, choices, pageTerm: null }).rows[0];
    expect(row?.state).toBe('notDone');
    expect(row?.chosen?.ids).toEqual(['A3']);
  });

  it('drops the hand marks a record held before choices', () => {
    const parsed = sectionChoicesSchema.parse({
      planId: plan.id,
      year: plan.year,
      semester: plan.semester,
      marks: { A: { state: 'added', at: '2026-11-24T01:00:00.000Z' } },
    });
    expect(parsed.choices).toEqual({});
    expect(
      deriveChecklist({ plan, kit, choices: parsed, pageTerm: null }).done,
    ).toBe(0);
  });

  it('works from the plan snapshots alone when there is no kit', () => {
    const list = deriveChecklist({
      plan,
      kit: null,
      choices: null,
      pageTerm: null,
    });
    expect(list.hasKit).toBe(false);
    expect(
      list.rows[0]?.planned.map((section) => section.teachTableId),
    ).toEqual(['A1']);
    expect(list.rows[0]?.alternatives).toEqual([]);
    expect(list.rows[0]?.plannedSeat).toBeNull();
  });

  it('ignores a kit and choices of another plan or term', () => {
    const other = makePlan({ id: 'plan-2', entries: plan.entries });
    const choices = withChoice(null, plan, 'A', ['A3']);
    const list = deriveChecklist({ plan: other, kit, choices, pageTerm: null });
    expect(list.hasKit).toBe(false);
    expect(list.rows[0]?.chosen).toBeNull();
  });

  it('puts every row in the term mismatch state when the page term differs', () => {
    const choices = null;
    const list = deriveChecklist({
      plan,
      kit,
      choices,
      pageTerm: { year: '2569', semester: '2' },
    });
    expect(list.termMismatch).toBe(true);
    expect(list.rows.every((row) => row.state === 'termMismatch')).toBe(true);
    expect(list.done).toBe(0);
    const same = deriveChecklist({
      plan,
      kit,
      choices,
      pageTerm: { year: '2569', semester: '1' },
    });
    expect(same.termMismatch).toBe(false);
  });

  it('flags a planned section the fresh kit no longer lists', () => {
    const gone = buildRegistrationKit({
      plan,
      results: new Map([
        ['A', catalogOf(makeCourse({ subjectId: 'A', sections: [A2] }))],
        ['B', null],
      ]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    const rows = deriveChecklist({
      plan,
      kit: gone,
      choices: null,
      pageTerm: null,
    }).rows;
    expect(rows.map((row) => row.missing)).toEqual([true, true]);
    // Without the planned group in the kit, the row still shows the plan's own times.
    expect(rows[0]?.planned[0]?.teachTableId).toBe('A1');
  });
});

describe('duplicate codes', () => {
  it('names the planned code listed under more than one curriculum', () => {
    const twin = { ...A1, teachTableId: 'A1-twin' };
    const course = makeCourse({ subjectId: 'A', sections: [A1, twin] });
    const single = makePlan({ entries: [entryFor(course, A1)] });
    const dupKit = buildRegistrationKit({
      plan: single,
      results: new Map([['A', catalogOf(course)]]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    const list = deriveChecklist({
      plan: single,
      kit: dupKit,
      choices: null,
      pageTerm: null,
    });
    expect(list.rows[0]?.duplicateCode).toBe('1');
  });
});

describe('withChoice', () => {
  it('clears a choice and starts fresh choices for another term', () => {
    const choices = withChoice(null, plan, 'A', ['A3']);
    expect(choices.choices).toEqual({ A: ['A3'] });
    expect(withChoice(choices, plan, 'A', null).choices).toEqual({});
    const next = makePlan({ semester: '2', entries: [] });
    expect(withChoice(choices, next, 'B', ['B1'])).toMatchObject({
      semester: '2',
      choices: { B: ['B1'] },
    });
  });
});
