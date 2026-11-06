import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { Section } from '../domain/types';
import { planConflicts } from './planConflicts';
import { planExamConflicts } from './examOverlap';
import { posterHonesty, reviewBeforeShareCount } from './posterHonesty';

const NO_CONFLICTS = new Map<string, never[]>();

function honestyFor(sections: Section[]) {
  return posterHonesty({
    entries: [],
    timeConflicts: planConflicts(sections),
    examConflicts: planExamConflicts(sections),
  });
}

const MIDTERM = { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' };
const MIDTERM_OVERLAP = {
  start: '2026-08-21 11:00:00',
  end: '2026-08-21 13:00:00',
};

describe('posterHonesty data date', () => {
  it('reports the oldest verification across the checked entries', () => {
    const result = posterHonesty({
      entries: [
        makePlanEntry({ lastVerifiedAt: '2026-11-06T03:00:00.000Z' }),
        makePlanEntry({ lastVerifiedAt: '2026-11-05T01:30:00.000Z' }),
        makePlanEntry({ lastVerifiedAt: '2026-11-06T08:00:00.000Z' }),
      ],
      timeConflicts: NO_CONFLICTS,
      examConflicts: NO_CONFLICTS,
    });
    expect(result.dataDate).toEqual({
      kind: 'asOf',
      at: '2026-11-05T01:30:00.000Z',
    });
  });

  it('reports unverified when every entry has a null lastVerifiedAt', () => {
    const result = posterHonesty({
      entries: [
        makePlanEntry({ lastVerifiedAt: null }),
        makePlanEntry({ lastVerifiedAt: null }),
      ],
      timeConflicts: NO_CONFLICTS,
      examConflicts: NO_CONFLICTS,
    });
    expect(result.dataDate).toEqual({ kind: 'unverified' });
  });

  it('reports unverified for a plan with no entries', () => {
    expect(
      posterHonesty({
        entries: [],
        timeConflicts: NO_CONFLICTS,
        examConflicts: NO_CONFLICTS,
      }).dataDate,
    ).toEqual({ kind: 'unverified' });
  });

  it('lets an entry added since the last check leave the date alone', () => {
    const result = posterHonesty({
      entries: [
        makePlanEntry({ lastVerifiedAt: '2026-11-06T03:00:00.000Z' }),
        makePlanEntry({ lastVerifiedAt: null }),
      ],
      timeConflicts: NO_CONFLICTS,
      examConflicts: NO_CONFLICTS,
    });
    expect(result.dataDate).toEqual({
      kind: 'asOf',
      at: '2026-11-06T03:00:00.000Z',
    });
  });

  it('skips a stored date that does not parse rather than reading it as oldest', () => {
    const result = posterHonesty({
      entries: [
        makePlanEntry({ lastVerifiedAt: 'not a date' }),
        makePlanEntry({ lastVerifiedAt: '2026-11-06T03:00:00.000Z' }),
      ],
      timeConflicts: NO_CONFLICTS,
      examConflicts: NO_CONFLICTS,
    });
    expect(result.dataDate).toEqual({
      kind: 'asOf',
      at: '2026-11-06T03:00:00.000Z',
    });
  });
});

describe('posterHonesty missing count', () => {
  it('counts the entries whose latest check found them missing', () => {
    const result = posterHonesty({
      entries: [
        makePlanEntry({ verifyStatus: 'missing' }),
        makePlanEntry({ verifyStatus: 'changed' }),
        makePlanEntry({ verifyStatus: 'missing' }),
        makePlanEntry({ verifyStatus: 'verified' }),
      ],
      timeConflicts: NO_CONFLICTS,
      examConflicts: NO_CONFLICTS,
    });
    expect(result.missingCount).toBe(2);
  });
});

describe('posterHonesty conflicting pairs', () => {
  it('counts a time overlap once although both sides record it', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    expect(honestyFor([a, b]).conflictPairCount).toBe(1);
  });

  it('counts each distinct pair when one section clashes with two others', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const c = makeSection({
      teachTableId: 'c',
      subjectId: 'S3',
      meetings: [makeMeeting({ day: 1, startMin: 660, endMin: 720 })],
    });
    expect(honestyFor([a, b, c]).conflictPairCount).toBe(2);
  });

  it('counts an exam clash, and a pair clashing on time and exam only once', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
      exam: { midterm: MIDTERM },
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
      exam: { midterm: MIDTERM_OVERLAP },
    });
    const unrelated = makeSection({
      teachTableId: 'c',
      subjectId: 'S3',
      meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 660 })],
      exam: {},
    });
    expect(honestyFor([a, b, unrelated]).conflictPairCount).toBe(1);

    const d = makeSection({
      teachTableId: 'd',
      subjectId: 'S4',
      meetings: [makeMeeting({ day: 4, startMin: 540, endMin: 660 })],
      exam: { midterm: MIDTERM_OVERLAP },
    });
    // d clashes with a and b on the exam only, adding two pairs to the one a and b share.
    expect(honestyFor([a, b, d]).conflictPairCount).toBe(3);
  });

  it('reports no pairs for a clean plan', () => {
    const a = makeSection({
      teachTableId: 'a',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    expect(honestyFor([a, b]).conflictPairCount).toBe(0);
  });
});

describe('reviewBeforeShareCount', () => {
  it('counts the changed and missing entries only', () => {
    expect(
      reviewBeforeShareCount([
        makePlanEntry({ verifyStatus: 'changed' }),
        makePlanEntry({ verifyStatus: 'missing' }),
        makePlanEntry({ verifyStatus: 'verified' }),
        makePlanEntry({ verifyStatus: 'unverified' }),
      ]),
    ).toBe(2);
  });

  it('is zero for a clean or empty plan', () => {
    expect(
      reviewBeforeShareCount([makePlanEntry({ verifyStatus: 'verified' })]),
    ).toBe(0);
    expect(reviewBeforeShareCount([])).toBe(0);
  });
});
