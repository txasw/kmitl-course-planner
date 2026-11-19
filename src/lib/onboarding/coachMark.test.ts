import { describe, expect, it } from 'vitest';
import {
  isSelectorRoute,
  localDayStamp,
  shouldShowCoachMark,
  type CoachMarkInput,
} from './coachMark';

const SELECTOR = '#/teach_table_selector';
const TODAY = '2026-11-20';

function input(overrides: Partial<CoachMarkInput> = {}): CoachMarkInput {
  return {
    settled: true,
    hash: SELECTOR,
    isOpen: false,
    welcomeOpen: false,
    documentSuppressed: false,
    snoozedOn: undefined,
    today: TODAY,
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

  it('keeps quiet through a stored day after today, after the clock moved back', () => {
    expect(shouldShowCoachMark(input({ snoozedOn: '2026-11-21' }))).toBe(false);
  });

  it('compares across a month and a year boundary', () => {
    expect(
      shouldShowCoachMark(
        input({ snoozedOn: '2026-12-31', today: '2027-01-01' }),
      ),
    ).toBe(true);
  });
});
