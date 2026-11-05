import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { SuggestChoice } from './suggestCandidates';
import {
  compareRanked,
  objectiveValue,
  type RankedTimetable,
} from './suggestRank';

function choice(subjectId: string, code: string): SuggestChoice {
  const section = makeSection({ subjectId, section: code });
  return { course: makeCourse({ subjectId }), section, group: [section] };
}

function ranked(
  objective: [number, number],
  penalty: number,
  choices: SuggestChoice[],
): RankedTimetable {
  return { objective, penalty, choices };
}

describe('objectiveValue', () => {
  it('puts courses first for coverAll and credits first for maxCredits', () => {
    expect(objectiveValue('coverAll', 5, 16)).toEqual([5, 16]);
    expect(objectiveValue('maxCredits', 5, 16)).toEqual([16, 5]);
  });
});

describe('compareRanked', () => {
  it('ranks the better objective first, then the lower penalty', () => {
    const more = ranked([5, 15], 900, []);
    const fewer = ranked([4, 16], 0, []);
    const calmer = ranked([5, 15], 100, []);
    expect([fewer, more, calmer].sort(compareRanked)).toEqual([
      calmer,
      more,
      fewer,
    ]);
  });

  it('breaks a full tie by subject id, then numeric section code', () => {
    const a10 = ranked([1, 3], 0, [choice('11111111', '10')]);
    const a9 = ranked([1, 3], 0, [choice('11111111', '9')]);
    const b1 = ranked([1, 3], 0, [choice('22222222', '1')]);
    expect([b1, a10, a9].sort(compareRanked)).toEqual([a9, a10, b1]);
  });

  it('ranks a prefix before the longer set', () => {
    const short = ranked([1, 3], 0, [choice('11111111', '1')]);
    const long = ranked([1, 3], 0, [
      choice('11111111', '1'),
      choice('22222222', '1'),
    ]);
    expect(compareRanked(short, long)).toBeLessThan(0);
  });
});
