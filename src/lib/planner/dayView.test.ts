import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import {
  dayChipDays,
  dayFlags,
  initialDay,
  isDayViewWidth,
  shownDay,
  stepDay,
} from './dayView';
import { planConflicts } from './planConflicts';

const WEEK = [1, 2, 3, 4, 5] as const;

describe('isDayViewWidth', () => {
  it('shows one day below 640 px and the week from 640 px', () => {
    expect(isDayViewWidth(358, false)).toBe(true);
    expect(isDayViewWidth(639, false)).toBe(true);
    expect(isDayViewWidth(640, true)).toBe(false);
    expect(isDayViewWidth(950, true)).toBe(false);
  });

  it('follows the layout tier before the scroller is measured', () => {
    expect(isDayViewWidth(0, true)).toBe(true);
    expect(isDayViewWidth(0, false)).toBe(false);
  });
});

describe('dayChipDays', () => {
  it('offers Monday to Friday when no meeting falls on the weekend', () => {
    expect(dayChipDays([makeMeeting({ day: 3 })])).toEqual(WEEK);
    expect(dayChipDays([])).toEqual(WEEK);
  });

  it('adds Saturday alone for a Saturday meeting', () => {
    expect(dayChipDays([makeMeeting({ day: 6 })])).toEqual([...WEEK, 6]);
  });

  it('adds Sunday alone for a Sunday meeting, after the week', () => {
    expect(dayChipDays([makeMeeting({ day: 0 })])).toEqual([...WEEK, 0]);
  });

  it('adds Saturday then Sunday when both carry a meeting', () => {
    expect(
      dayChipDays([makeMeeting({ day: 0 }), makeMeeting({ day: 6 })]),
    ).toEqual([...WEEK, 6, 0]);
  });
});

describe('dayFlags', () => {
  it('marks each day that carries a meeting and no other', () => {
    const flags = dayFlags(
      [makeMeeting({ day: 2 }), makeMeeting({ day: 4 })],
      new Map(),
    );
    expect(flags[2]).toEqual({ hasClass: true, hasConflict: false });
    expect(flags[4].hasClass).toBe(true);
    expect(flags[1]).toEqual({ hasClass: false, hasConflict: false });
    expect(flags[0].hasClass).toBe(false);
  });

  it('marks the day of a time conflict and not the other class days', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: '90000001',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: '90000002',
      meetings: [
        makeMeeting({ day: 1, startMin: 600, endMin: 720 }),
        makeMeeting({ day: 3, startMin: 540, endMin: 600 }),
      ],
    });
    const meetings = [...a.meetings, ...b.meetings];
    const flags = dayFlags(meetings, planConflicts([a, b]));
    expect(flags[1]).toEqual({ hasClass: true, hasConflict: true });
    expect(flags[3]).toEqual({ hasClass: true, hasConflict: false });
  });

  it('marks no day for an exam overlap, which is dated rather than weekly', () => {
    const flags = dayFlags(
      [makeMeeting({ day: 2 })],
      new Map([
        [
          'a',
          [
            {
              kind: 'exam' as const,
              blocking: {
                teachTableId: 'b',
                subjectId: '90000002',
                section: '901',
              },
              examKind: 'final' as const,
              self: {
                start: '2026-10-01 09:00:00',
                end: '2026-10-01 12:00:00',
              },
              other: {
                start: '2026-10-01 10:00:00',
                end: '2026-10-01 13:00:00',
              },
            },
          ],
        ],
      ]),
    );
    expect(Object.values(flags).some((flag) => flag.hasConflict)).toBe(false);
  });
});

describe('initialDay', () => {
  it('opens on the first day with a class', () => {
    const flags = dayFlags(
      [makeMeeting({ day: 5 }), makeMeeting({ day: 3 })],
      new Map(),
    );
    expect(initialDay(WEEK, flags)).toBe(3);
  });

  it('opens on a weekend day when only the weekend carries a class', () => {
    const meetings = [makeMeeting({ day: 6 })];
    expect(
      initialDay(dayChipDays(meetings), dayFlags(meetings, new Map())),
    ).toBe(6);
  });

  it('opens on Monday when no class is scheduled', () => {
    expect(initialDay(WEEK, dayFlags([], new Map()))).toBe(1);
  });
});

describe('shownDay', () => {
  const flags = dayFlags([makeMeeting({ day: 4 })], new Map());

  it('keeps the chosen day while the chips offer it', () => {
    expect(shownDay(WEEK, 2, flags)).toBe(2);
  });

  it('falls back to the initial day when nothing is chosen', () => {
    expect(shownDay(WEEK, null, flags)).toBe(4);
  });

  it('falls back when the chosen day lost its chip', () => {
    expect(shownDay(WEEK, 6, flags)).toBe(4);
  });
});

describe('stepDay', () => {
  it('moves to the neighbouring day in chip order', () => {
    expect(stepDay(WEEK, 2, 1, false)).toBe(3);
    expect(stepDay(WEEK, 2, -1, false)).toBe(1);
    expect(stepDay([...WEEK, 6, 0], 6, 1, false)).toBe(0);
  });

  it('stops at either end without wrapping', () => {
    expect(stepDay(WEEK, 5, 1, false)).toBe(5);
    expect(stepDay(WEEK, 1, -1, false)).toBe(1);
  });

  it('wraps around the row when asked, as the arrow keys do', () => {
    expect(stepDay(WEEK, 5, 1, true)).toBe(1);
    expect(stepDay(WEEK, 1, -1, true)).toBe(5);
  });

  it('starts from the first day when the current day is not offered', () => {
    expect(stepDay(WEEK, 0, 1, false)).toBe(1);
  });
});
