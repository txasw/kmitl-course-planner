import { describe, it, expect } from 'vitest';
import type { Course, Section } from '../domain/types';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toSnapshot } from '../planner/transaction';
import { deriveChecklist } from './checklist';
import type { HostObservation } from './hostObservation';
import type { ObservedPage } from './observedRow';

// The checklist ticks itself from what the read only observer saw on the page, the only
// source of a row's state (ADR-0077).

function entryFor(course: Course, section: Section) {
  return makePlanEntry({ snapshot: toSnapshot(course, section) });
}

const LECTURE = makeSection({
  teachTableId: 'L1',
  subjectId: '01476107',
  section: '1',
  kind: 'lecture',
  pairedSection: '101',
  meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
});
const PRACTICE = makeSection({
  teachTableId: 'P101',
  subjectId: '01476107',
  section: '101',
  kind: 'practice',
  pairedSection: '1',
  meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 660 })],
});
const SOLO = makeSection({
  teachTableId: 'S2',
  subjectId: '01476106',
  section: '2',
  kind: 'lecture',
  meetings: [makeMeeting({ day: 4, startMin: 780, endMin: 900 })],
});
const PAIRED = makeCourse({
  subjectId: '01476107',
  sections: [LECTURE, PRACTICE],
});
const SINGLE = makeCourse({ subjectId: '01476106', sections: [SOLO] });
const plan = makePlan({
  entries: [
    entryFor(PAIRED, LECTURE),
    entryFor(PAIRED, PRACTICE),
    entryFor(SINGLE, SOLO),
  ],
});

function observed(
  patch: Partial<HostObservation>,
  conditional: ObservedPage['conditional'] = {},
): ObservedPage {
  return {
    observation: {
      step: 2,
      term: { year: '2569', semester: '1' },
      card: null,
      list: [],
      credits: null,
      dialog: null,
      toasts: [],
      results: null,
      ...patch,
    },
    conditional,
  };
}

function derive(page: ObservedPage | null) {
  return deriveChecklist({
    plan,
    kit: null,
    choices: null,
    pageTerm: page?.observation.term ?? null,
    page,
  });
}

const lecture = (section: string) => ({
  subjectId: '01476107',
  section,
  kind: 'lecture' as const,
  curriculum: null,
});
const practice = (section: string) => ({
  ...lecture(section),
  kind: 'practice' as const,
});

describe('deriveChecklist with the page observed', () => {
  it('shows no page state while no observation backs the rows', () => {
    const list = derive(null);
    expect(list.rows.map((row) => row.observed)).toEqual([null, null]);
  });

  it('ticks a subject the page lists with the planned group, half for half', () => {
    const list = derive(observed({ list: [lecture('1'), practice('101')] }));
    expect(list.rows.map((row) => [row.subjectId, row.state])).toEqual([
      ['01476106', 'notDone'],
      ['01476107', 'added'],
    ]);
    expect(list.rows[0]?.observed?.state).toBe('notListed');
    expect(list).toMatchObject({ listedPlanned: 1 });
  });

  it('reads another section, a missing half, or another kind as other', () => {
    for (const rows of [
      [lecture('2'), practice('101')],
      [lecture('1')],
      [lecture('1'), lecture('101')],
    ]) {
      const row = derive(observed({ list: rows })).rows[1];
      expect(row?.state).toBe('addedOther');
      expect(row?.observed?.codes).toEqual(rows.map((item) => item.section));
    }
  });

  it('marks a subject a refusal toast names as refused, not done', () => {
    const list = derive(
      observed({ toasts: [{ kind: 'refused', subjectId: '01476106' }] }),
    );
    expect(list.rows[0]?.state).toBe('refused');
  });

  it('carries the prerequisite ids and lists the row as conditional', () => {
    const page = observed(
      { list: [{ ...lecture('2'), subjectId: '01476106' }] },
      { '01476106': ['01476105'] },
    );
    const row = derive(page).rows[0];
    expect(row?.state).toBe('conditional');
    expect(row?.observed?.prerequisites).toEqual(['01476105']);
  });

  it('names the subjects the page lists that the plan does not hold', () => {
    const list = derive(
      observed({
        list: [{ ...lecture('3'), subjectId: '90641007' }, lecture('1')],
      }),
    );
    expect(list.extras).toEqual([{ subjectId: '90641007', codes: ['3'] }]);
  });

  it('shows no page state on a page of another term', () => {
    const page = observed({
      term: { year: '2569', semester: '2' },
      list: [lecture('1'), practice('101')],
    });
    const list = derive(page);
    expect(list.termMismatch).toBe(true);
    expect(list.rows.every((row) => row.state === 'termMismatch')).toBe(true);
    expect(list.rows.every((row) => row.observed === null)).toBe(true);
    expect(list.extras).toEqual([]);
  });

  it('reads the results on the complete step', () => {
    const result = (
      subjectId: string,
      section: string,
      outcome: 'waiting' | 'granted' | 'notGranted',
    ) => ({
      subjectId,
      section,
      kind: null,
      curriculum: null,
      result: outcome,
    });
    const granted = derive(
      observed({
        step: 3,
        list: null,
        results: [
          result('01476107', '1', 'granted'),
          result('01476107', '101', 'granted'),
        ],
      }),
    );
    expect(granted.rows.map((row) => row.state)).toEqual([
      'notSubmitted',
      'granted',
    ]);
    const mixed = derive(
      observed({
        step: 3,
        list: null,
        results: [
          result('01476107', '1', 'granted'),
          result('01476107', '101', 'waiting'),
          result('01476106', '2', 'notGranted'),
        ],
      }),
    );
    expect(mixed.rows.map((row) => row.state)).toEqual([
      'notGranted',
      'submitted',
    ]);
  });

  it('shows no page state on a step without a list', () => {
    const list = derive(observed({ step: 1, list: null }));
    expect(list.rows.every((row) => row.observed === null)).toBe(true);
  });
});
