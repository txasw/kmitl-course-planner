import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { Meeting, Section } from '../domain/types';
import type { SuggestChoice } from './suggestCandidates';
import {
  collapseInterchangeable,
  groupFootprint,
  keepDistinct,
  timetableFootprint,
} from './suggestFootprint';
import type { RankedTimetable } from './suggestRank';

const MONDAY = makeMeeting({ day: 1, startMin: 540, endMin: 720 });
const TUESDAY = makeMeeting({ day: 2, startMin: 780, endMin: 960 });
const FINAL_A = { start: '2026-10-05 09:30:00', end: '2026-10-05 12:30:00' };
const FINAL_B = { start: '2026-10-06 09:30:00', end: '2026-10-06 12:30:00' };

function section(
  subjectId: string,
  code: string,
  meetings: Meeting[],
  overrides: Partial<Section> = {},
): Section {
  return makeSection({
    teachTableId: `${subjectId}-${code}`,
    subjectId,
    section: code,
    meetings,
    ...overrides,
  });
}

function choice(group: Section[]): SuggestChoice {
  const [first] = group;
  if (first === undefined) {
    throw new Error('empty group');
  }
  return {
    course: makeCourse({ subjectId: first.subjectId, sections: group }),
    section: first,
    group,
  };
}

function ranked(
  objective: [number, number],
  penalty: number,
  choices: SuggestChoice[],
): RankedTimetable {
  return {
    objective,
    penalty,
    choices,
    footprint: timetableFootprint(choices),
  };
}

describe('groupFootprint', () => {
  it('reads only the days and minutes, in any member order', () => {
    const lecture = section('1', '1', [MONDAY]);
    const practice = section('1', '2', [{ ...TUESDAY, room: 'B202' }], {
      kind: 'practice',
    });
    expect(groupFootprint([lecture, practice])).toBe(
      groupFootprint([
        section('1', '9', [TUESDAY]),
        section('1', '8', [MONDAY]),
      ]),
    );
    expect(groupFootprint([lecture])).not.toBe(groupFootprint([practice]));
  });

  it('gives an unscheduled group an empty footprint', () => {
    expect(groupFootprint([section('1', '1', [])])).toBe('');
  });
});

describe('timetableFootprint', () => {
  it('matches two timetables that differ only in section codes', () => {
    const a = [
      choice([section('11111111', '1', [MONDAY])]),
      choice([section('22222222', '1', [TUESDAY])]),
    ];
    const b = [
      choice([section('22222222', '3', [TUESDAY])]),
      choice([section('11111111', '2', [MONDAY])]),
    ];
    expect(timetableFootprint(a)).toBe(timetableFootprint(b));
  });

  it('tells apart the same times held by different subjects', () => {
    const a = [
      choice([section('11111111', '1', [MONDAY])]),
      choice([section('22222222', '1', [TUESDAY])]),
    ];
    const swapped = [
      choice([section('11111111', '1', [TUESDAY])]),
      choice([section('22222222', '1', [MONDAY])]),
    ];
    expect(timetableFootprint(a)).not.toBe(timetableFootprint(swapped));
  });
});

describe('collapseInterchangeable', () => {
  it('keeps the lowest section code of groups with one time and exam', () => {
    const choices = [
      choice([section('1', '10', [MONDAY])]),
      choice([section('1', '2', [MONDAY])]),
      choice([section('1', '3', [TUESDAY])]),
    ];
    expect(
      collapseInterchangeable(choices).map((c) => c.section.section),
    ).toEqual(['2', '3']);
  });

  it('keeps both when the exam windows differ', () => {
    const choices = [
      choice([section('1', '1', [MONDAY], { exam: { final: FINAL_A } })]),
      choice([section('1', '2', [MONDAY], { exam: { final: FINAL_B } })]),
    ];
    expect(collapseInterchangeable(choices)).toHaveLength(2);
  });

  it('compares a declared pair as one group', () => {
    const pair = (lecture: string, practice: string, lab: Meeting) =>
      choice([
        section('1', lecture, [MONDAY]),
        section('1', practice, [lab], { kind: 'practice' }),
      ]);
    const thursday = makeMeeting({ day: 4, startMin: 780, endMin: 960 });
    const choices = [
      pair('1', '2', TUESDAY),
      pair('3', '4', TUESDAY),
      pair('5', '6', thursday),
    ];
    expect(
      collapseInterchangeable(choices).map((c) =>
        c.group.map((member) => member.section),
      ),
    ).toEqual([
      ['1', '2'],
      ['5', '6'],
    ]);
  });
});

describe('keepDistinct', () => {
  const lower = ranked([1, 3], 0, [choice([section('1', '1', [MONDAY])])]);
  const higher = ranked([1, 3], 0, [choice([section('1', '2', [MONDAY])])]);
  const other = ranked([1, 3], 60, [choice([section('1', '3', [TUESDAY])])]);

  it('drops a twin that ranks after the kept one', () => {
    expect(keepDistinct([lower], higher, 3)).toEqual([lower]);
  });

  it('replaces a twin that ranks before the kept one', () => {
    expect(keepDistinct([higher, other], lower, 3)).toEqual([lower, other]);
  });

  it('keeps distinct footprints best first up to the limit', () => {
    const worst = ranked([0, 0], 0, []);
    expect(keepDistinct([lower, worst], other, 2)).toEqual([lower, other]);
  });
});
