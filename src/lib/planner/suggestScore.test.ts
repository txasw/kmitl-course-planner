import { describe, it, expect } from 'vitest';
import { makeMeeting } from '../../../tests/support/domain-builders';
import type { Meeting } from '../domain/types';
import {
  BALANCED_DAY_WEIGHT,
  penaltyLowerBound,
  preferencePenalty,
  timetableStats,
  type SuggestPreference,
} from './suggestScore';

const PREFERENCES: SuggestPreference[] = [
  'balanced',
  'morning',
  'afternoon',
  'fewerDays',
  'compact',
];

// Monday 09:00 to 12:00, Monday 13:00 to 16:00, Wednesday 10:30 to 13:30.
const WEEK: Meeting[] = [
  makeMeeting({ day: 1, startMin: 540, endMin: 720 }),
  makeMeeting({ day: 1, startMin: 780, endMin: 960 }),
  makeMeeting({ day: 3, startMin: 630, endMin: 810 }),
];

describe('timetableStats', () => {
  it('reads the days, the span, and the idle time of a week', () => {
    expect(timetableStats(WEEK)).toEqual({
      days: 2,
      earliestStartMin: 540,
      latestEndMin: 960,
      idleMinutes: 60,
    });
  });

  it('reports no span for an empty timetable', () => {
    expect(timetableStats([])).toEqual({
      days: 0,
      earliestStartMin: null,
      latestEndMin: null,
      idleMinutes: 0,
    });
  });

  it('merges overlapping and touching meetings before counting idle time', () => {
    const meetings = [
      makeMeeting({ day: 2, startMin: 600, endMin: 720 }),
      makeMeeting({ day: 2, startMin: 540, endMin: 660 }),
      makeMeeting({ day: 2, startMin: 720, endMin: 780 }),
      makeMeeting({ day: 2, startMin: 900, endMin: 960 }),
    ];
    expect(timetableStats(meetings).idleMinutes).toBe(120);
  });
});

describe('preferencePenalty', () => {
  it('counts the class minutes on the wrong side of noon', () => {
    expect(preferencePenalty(WEEK, 'morning')).toBe(180 + 90);
    expect(preferencePenalty(WEEK, 'afternoon')).toBe(180 + 90);
    const early = [makeMeeting({ day: 1, startMin: 480, endMin: 600 })];
    expect(preferencePenalty(early, 'morning')).toBe(0);
    expect(preferencePenalty(early, 'afternoon')).toBe(120);
  });

  it('counts class days, idle time, and their balanced blend', () => {
    expect(preferencePenalty(WEEK, 'fewerDays')).toBe(2);
    expect(preferencePenalty(WEEK, 'compact')).toBe(60);
    expect(preferencePenalty(WEEK, 'balanced')).toBe(
      2 * BALANCED_DAY_WEIGHT + 60,
    );
  });

  it('prefers a compact day under compact and fewer days under fewerDays', () => {
    const spread = [
      makeMeeting({ day: 1, startMin: 540, endMin: 720 }),
      makeMeeting({ day: 2, startMin: 540, endMin: 720 }),
    ];
    const gapped = [
      makeMeeting({ day: 1, startMin: 540, endMin: 720 }),
      makeMeeting({ day: 1, startMin: 900, endMin: 1080 }),
    ];
    expect(preferencePenalty(spread, 'compact')).toBeLessThan(
      preferencePenalty(gapped, 'compact'),
    );
    expect(preferencePenalty(gapped, 'fewerDays')).toBeLessThan(
      preferencePenalty(spread, 'fewerDays'),
    );
  });
});

describe('penaltyLowerBound', () => {
  it('never exceeds the penalty of a timetable that adds meetings', () => {
    const base = WEEK.slice(0, 2);
    const gapFiller = makeMeeting({ day: 1, startMin: 720, endMin: 780 });
    for (const preference of PREFERENCES) {
      const bound = penaltyLowerBound(base, preference);
      expect(bound).toBeLessThanOrEqual(preferencePenalty(base, preference));
      expect(bound).toBeLessThanOrEqual(
        preferencePenalty([...base, gapFiller], preference),
      );
      expect(bound).toBeLessThanOrEqual(
        preferencePenalty([...base, ...WEEK], preference),
      );
    }
  });

  it('is exact for the preferences that only grow', () => {
    for (const preference of ['morning', 'afternoon', 'fewerDays'] as const) {
      expect(penaltyLowerBound(WEEK, preference)).toBe(
        preferencePenalty(WEEK, preference),
      );
    }
    expect(penaltyLowerBound(WEEK, 'compact')).toBe(0);
    expect(penaltyLowerBound(WEEK, 'balanced')).toBe(2 * BALANCED_DAY_WEIGHT);
  });
});
