import { describe, expect, it } from 'vitest';
import {
  isSelectorRoute,
  localDayStamp,
  nextLocalDayStamp,
  shouldShowCoachMark,
  type CoachMarkInput,
} from './coachMark';

const SELECTOR = '#/teach_table_selector';
const TODAY = '2026-11-20';
const TOMORROW = '2026-11-21';

function input(overrides: Partial<CoachMarkInput> = {}): CoachMarkInput {
  return {
    settled: true,
    hash: SELECTOR,
    isOpen: false,
    welcomeOpen: false,
    documentSuppressed: false,
    snoozedOn: undefined,
    today: TODAY,
    tomorrow: TOMORROW,
    dismissedThisVisit: false,
    ...overrides,
  };
}

describe('isSelectorRoute', () => {
  it.each([
    SELECTOR,
    '#/teach_table_selector/',
    '#/teach_table_selector?tab=2',
    '/teach_table_selector',
  ])('accepts %s', (hash) => {
    expect(isSelectorRoute(hash)).toBe(true);
  });

  it.each([
    '',
    '#/',
    '#/teach_table?mode=by_subject_id&selected_year=2569',
    '#/teach_table_selector_extra',
    '#/teach_table_selector/nested',
    '#/other#/teach_table_selector',
  ])('rejects %s', (hash) => {
    expect(isSelectorRoute(hash)).toBe(false);
  });
});

describe('localDayStamp', () => {
  it('pads the month and the day', () => {
    expect(localDayStamp(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
  });

  it('reads the local calendar day at both ends of it', () => {
    expect(localDayStamp(new Date(2026, 10, 20, 0, 0, 0))).toBe(TODAY);
    expect(localDayStamp(new Date(2026, 10, 20, 23, 59, 59))).toBe(TODAY);
  });
});

describe('nextLocalDayStamp', () => {
  it('names the local day after, across a month and a year boundary', () => {
    expect(nextLocalDayStamp(new Date(2026, 10, 20, 23, 59, 59))).toBe(
      TOMORROW,
    );
    expect(nextLocalDayStamp(new Date(2026, 10, 30, 12))).toBe('2026-12-01');
    expect(nextLocalDayStamp(new Date(2026, 11, 31, 0, 0))).toBe('2027-01-01');
  });
});

describe('shouldShowCoachMark', () => {
  it('shows on a settled visit of the selector route', () => {
    expect(shouldShowCoachMark(input())).toBe(true);
  });

  it('waits until everything it reads has settled', () => {
    expect(shouldShowCoachMark(input({ settled: false }))).toBe(false);
  });

  it('shows only on the selector route', () => {
    expect(
      shouldShowCoachMark(input({ hash: '#/teach_table?mode=by_class' })),
    ).toBe(false);
  });

  it('stays away while the panel is open', () => {
    expect(shouldShowCoachMark(input({ isOpen: true }))).toBe(false);
  });

  it('stays away while the welcome is open', () => {
    expect(shouldShowCoachMark(input({ welcomeOpen: true }))).toBe(false);
  });

  it('stays away in a document that found the welcome pending or applied an open', () => {
    expect(shouldShowCoachMark(input({ documentSuppressed: true }))).toBe(
      false,
    );
  });

  it('stays away for the rest of a visit once dismissed', () => {
    expect(shouldShowCoachMark(input({ dismissedThisVisit: true }))).toBe(
      false,
    );
  });

  it('stays away on the day the student chose not again today', () => {
    expect(shouldShowCoachMark(input({ snoozedOn: TODAY }))).toBe(false);
  });

  it('comes back on the next day', () => {
    expect(
      shouldShowCoachMark(
        input({ snoozedOn: '2026-11-19', today: '2026-11-20' }),
      ),
    ).toBe(true);
  });

  it('keeps quiet through a stored day one day ahead, after the clock moved back', () => {
    expect(shouldShowCoachMark(input({ snoozedOn: TOMORROW }))).toBe(false);
  });

  it('shows past a stored day further ahead, which a clock set forward left', () => {
    expect(shouldShowCoachMark(input({ snoozedOn: '2026-11-22' }))).toBe(true);
    expect(shouldShowCoachMark(input({ snoozedOn: '2030-01-01' }))).toBe(true);
  });

  it('compares across a month and a year boundary', () => {
    expect(
      shouldShowCoachMark(
        input({
          snoozedOn: '2026-12-31',
          today: '2027-01-01',
          tomorrow: '2027-01-02',
        }),
      ),
    ).toBe(true);
  });
});
