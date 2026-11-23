import { describe, expect, it } from 'vitest';
import { consumeStudentPress, issueStudentPress } from './studentPress';

const CLICK = { isTrusted: true, detail: 1, timeStamp: 1000 };

describe('issueStudentPress', () => {
  it('issues a press for a trusted single click on a settled control', () => {
    expect(issueStudentPress(CLICK, 0, 1100, true)).not.toBeNull();
  });

  it('accepts a keyboard activation, which has no click count', () => {
    expect(
      issueStudentPress({ ...CLICK, detail: 0 }, 0, 1100, true),
    ).not.toBeNull();
  });

  it.each([
    ['an untrusted event', { ...CLICK, isTrusted: false }, 0, 1100, true],
    [
      'the second click of a double click',
      { ...CLICK, detail: 2 },
      0,
      1100,
      true,
    ],
    ['a click older than a second', CLICK, 0, 2500, true],
    ['a control shown for under half a second', CLICK, 800, 1100, true],
    ['no user activation', CLICK, 0, 1100, false],
  ])('refuses %s', (_name, event, shownAt, now, active) => {
    expect(issueStudentPress(event, shownAt, now, active)).toBeNull();
  });
});

describe('consumeStudentPress', () => {
  it('lets a press start one run only', () => {
    const press = issueStudentPress(CLICK, 0, 1100, true);
    if (press === null) throw new Error('no press');
    expect(consumeStudentPress(press)).toBe(true);
    expect(consumeStudentPress(press)).toBe(false);
  });
});
