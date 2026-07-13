import { describe, it, expect } from 'vitest';
import type { DayOfWeek } from '../parsing/days';
import type { Meeting } from '../domain/types';
import {
  DEFAULT_WINDOW,
  SMART_WINDOW,
  computeFitWindow,
  computeSmartWindow,
  computeWindow,
  hourTicks,
  meetingColumns,
  perDayLoad,
  quarterCount,
  smartVisibleDays,
  visibleDays,
} from './grid';

function meeting(day: DayOfWeek, startMin: number, endMin: number): Meeting {
  return { day, startMin, endMin, room: '', building: '', kind: 'lecture' };
}

describe('meetingColumns', () => {
  it('spans quarters 8 through 20 for a 09:00 to 12:00 meeting', () => {
    // The worked example: 540 to 720 in the 07:00 window. Rendered with a leading
    // day label column this becomes grid-column 10 / 22.
    expect(meetingColumns(540, 720, DEFAULT_WINDOW)).toEqual({
      startQuarter: 8,
      endQuarter: 20,
      span: 12,
    });
  });

  it('starts at column zero for a meeting at the window start', () => {
    expect(meetingColumns(420, 480, DEFAULT_WINDOW)).toEqual({
      startQuarter: 0,
      endQuarter: 4,
      span: 4,
    });
  });

  it('spans the whole default window for a 07:00 to 21:00 meeting', () => {
    expect(meetingColumns(420, 1260, DEFAULT_WINDOW)).toEqual({
      startQuarter: 0,
      endQuarter: 56,
      span: 56,
    });
  });

  it('floors the start and ceils the end for a meeting off the quarter grid', () => {
    // 09:05 to 10:35 fills whole columns 8 through 15 that fully contain it.
    expect(meetingColumns(545, 635, DEFAULT_WINDOW)).toEqual({
      startQuarter: 8,
      endQuarter: 15,
      span: 7,
    });
  });
});

describe('quarterCount', () => {
  it('counts 56 quarters across the default window', () => {
    expect(quarterCount(DEFAULT_WINDOW)).toBe(56);
  });
});

describe('computeWindow', () => {
  it('returns the default window when there are no meetings', () => {
    expect(computeWindow([])).toEqual(DEFAULT_WINDOW);
  });

  it('leaves the window unchanged for a meeting fully inside it', () => {
    expect(computeWindow([meeting(1, 540, 600)])).toEqual(DEFAULT_WINDOW);
  });

  it('extends the end up to the nearest hour for a late meeting', () => {
    expect(computeWindow([meeting(1, 1200, 1290)])).toEqual({
      startMin: 420,
      endMin: 1320,
    });
  });

  it('extends the start down to the nearest hour for an early meeting', () => {
    expect(computeWindow([meeting(1, 390, 480)])).toEqual({
      startMin: 360,
      endMin: 1260,
    });
  });

  it('extends both ends across several meetings', () => {
    const window = computeWindow([
      meeting(1, 390, 480),
      meeting(5, 1230, 1275),
    ]);
    expect(window).toEqual({ startMin: 360, endMin: 1320 });
  });
});

describe('computeFitWindow', () => {
  it('falls back to the default window when there are no meetings', () => {
    expect(computeFitWindow([])).toEqual(DEFAULT_WINDOW);
  });

  it('trims to the hours the meetings occupy', () => {
    const window = computeFitWindow([
      meeting(1, 540, 660), // 09:00 to 11:00
      meeting(3, 780, 900), // 13:00 to 15:00
    ]);
    expect(window).toEqual({ startMin: 540, endMin: 900 });
  });

  it('floors the start and ceils the end to the hour off the grid', () => {
    // 09:05 to 10:35 trims to a 09:00 to 11:00 window.
    expect(computeFitWindow([meeting(1, 545, 635)])).toEqual({
      startMin: 540,
      endMin: 660,
    });
  });

  it('keeps at least a one hour window for a short meeting', () => {
    expect(computeFitWindow([meeting(1, 540, 570)])).toEqual({
      startMin: 540,
      endMin: 600,
    });
  });
});

describe('visibleDays', () => {
  it('returns the full week when there are no meetings', () => {
    expect(visibleDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('trims empty leading and trailing days', () => {
    expect(visibleDays([meeting(1, 540, 600), meeting(3, 540, 600)])).toEqual([
      1, 2, 3,
    ]);
  });

  it('keeps interior empty days within the run', () => {
    expect(visibleDays([meeting(1, 540, 600), meeting(5, 540, 600)])).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('returns a single day when every meeting is on it', () => {
    expect(visibleDays([meeting(3, 540, 600), meeting(3, 780, 840)])).toEqual([
      3,
    ]);
  });
});

describe('computeSmartWindow', () => {
  it('returns the 08:00 to 18:00 base when every meeting is inside it', () => {
    expect(computeSmartWindow([meeting(1, 540, 660)])).toEqual(SMART_WINDOW);
    expect(SMART_WINDOW).toEqual({ startMin: 480, endMin: 1080 });
  });

  it('returns the base window when there are no meetings', () => {
    expect(computeSmartWindow([])).toEqual(SMART_WINDOW);
  });

  it('extends the end up to the hour that clears a late meeting', () => {
    // 18:00 to 19:30 pushes the boundary to 20:00.
    expect(computeSmartWindow([meeting(1, 1080, 1170)])).toEqual({
      startMin: 480,
      endMin: 1200,
    });
  });

  it('extends the start down to the hour that clears an early meeting', () => {
    // 07:15 to 08:15 pulls the boundary to 07:00.
    expect(computeSmartWindow([meeting(1, 435, 495)])).toEqual({
      startMin: 420,
      endMin: 1080,
    });
  });
});

describe('smartVisibleDays', () => {
  it('shows Monday through Friday when every meeting is a weekday', () => {
    expect(
      smartVisibleDays([meeting(1, 540, 600), meeting(5, 540, 600)]),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows the base week even with no meetings', () => {
    expect(smartVisibleDays([])).toEqual([1, 2, 3, 4, 5]);
  });

  it('reveals Sunday for a Sunday meeting', () => {
    expect(smartVisibleDays([meeting(0, 540, 600)])).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it('reveals both Saturday and Sunday for a Saturday meeting', () => {
    expect(smartVisibleDays([meeting(6, 540, 600)])).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });
});

describe('hourTicks', () => {
  it('lists every hour boundary across the default window', () => {
    const ticks = hourTicks(DEFAULT_WINDOW);
    expect(ticks).toHaveLength(15);
    expect(ticks[0]).toBe(420);
    expect(ticks[ticks.length - 1]).toBe(1260);
  });
});

describe('perDayLoad', () => {
  it('sums scheduled minutes per day', () => {
    const load = perDayLoad([
      meeting(1, 540, 720), // Monday 3h
      meeting(1, 780, 840), // Monday 1h
      meeting(5, 480, 600), // Friday 2h
    ]);
    expect(load).toEqual({ 0: 0, 1: 240, 2: 0, 3: 0, 4: 0, 5: 120, 6: 0 });
  });

  it('reports zero load for every day when there are no meetings', () => {
    expect(perDayLoad([])).toEqual({
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    });
  });
});
