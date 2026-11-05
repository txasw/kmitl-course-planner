import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { Section } from '../domain/types';
import { leftOutReason } from './suggestReasons';

const MIDTERM = { start: '2026-08-17 09:30:00', end: '2026-08-17 12:30:00' };
const LATER = { start: '2026-08-18 09:30:00', end: '2026-08-18 12:30:00' };

function section(
  subjectId: string,
  code: string,
  overrides: Partial<Section> = {},
): Section {
  return makeSection({
    teachTableId: `${subjectId}-${code}`,
    subjectId,
    section: code,
    ...overrides,
  });
}

const monday = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
const tuesday = [makeMeeting({ day: 2, startMin: 540, endMin: 720 })];

describe('leftOutReason', () => {
  it('reports seats when no section group is open', () => {
    expect(leftOutReason([], [], [])).toEqual({ kind: 'seats' });
  });

  it('names the subject whose exam every open group overlaps', () => {
    const chosen = section('22222222', '1', {
      meetings: monday,
      exam: { midterm: MIDTERM },
    });
    const open = [
      [
        section('11111111', '1', {
          meetings: tuesday,
          exam: { midterm: MIDTERM },
        }),
      ],
      [section('11111111', '2', { meetings: [], exam: { midterm: MIDTERM } })],
    ];
    expect(leftOutReason(open, [], [chosen])).toEqual({
      kind: 'exam',
      blocking: {
        teachTableId: '22222222-1',
        subjectId: '22222222',
        section: '1',
      },
    });
  });

  it('does not blame an exam that only some groups overlap', () => {
    const locked = section('33333333', '1', {
      meetings: tuesday,
      exam: { midterm: MIDTERM },
    });
    const open = [
      [
        section('11111111', '1', {
          meetings: tuesday,
          exam: { midterm: MIDTERM },
        }),
      ],
      [
        section('11111111', '2', {
          meetings: tuesday,
          exam: { midterm: LATER },
        }),
      ],
    ];
    expect(leftOutReason(open, [locked], [locked])).toEqual({
      kind: 'locked',
      blocking: {
        teachTableId: '33333333-1',
        subjectId: '33333333',
        section: '1',
      },
    });
  });

  it('never names a section of the course itself as the locked blocker', () => {
    const lecture = section('11111111', '1', {
      meetings: monday,
      pairedSection: '101',
    });
    const practice = section('11111111', '101', {
      meetings: monday,
      pairedSection: '1',
    });
    expect(leftOutReason([[lecture, practice]], [], [])).toEqual({
      kind: 'noFit',
    });
  });

  it('reports no fit when a group fits the locked entries but not the chosen set', () => {
    const locked = section('33333333', '1', { meetings: monday });
    const chosen = section('22222222', '1', { meetings: tuesday });
    const open = [[section('11111111', '1', { meetings: tuesday })]];
    expect(leftOutReason(open, [locked], [locked, chosen])).toEqual({
      kind: 'noFit',
    });
  });
});
