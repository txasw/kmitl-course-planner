import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { makePlan } from '../../../../tests/support/domain-builders';
import { createTranslator } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { AddForMeButton } from './FillControls';

// A press counts only once its button has shown the same action for a moment. The focus
// card keeps one Add for me in place while the subject in focus moves on, and a stop that
// reads over subscribed turns the same button into one that keeps a full section, so a
// change of what the button adds starts its moment again: a click that lands just after
// the page moved the focus is not a press for the subject it now names.

const issue = vi.hoisted(() =>
  vi.fn<(event: unknown, shownAt: number) => null>(() => null),
);
vi.mock('./studentPress', () => ({ issueStudentPress: issue }));

const t = createTranslator('en');
const PLAN = makePlan();
// Test only: the button reads the row's id and passes the kit through unread.
const KIT = { subjects: [] } as unknown as RegistrationKit;

function row(subjectId: string): ChecklistRow {
  // Test only: the button names the subject by id and hands the row on unread.
  return { subjectId } as unknown as ChecklistRow;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  issue.mockClear();
});

function shownAtOfClick(): number | undefined {
  fireEvent.click(screen.getByRole('button', { name: 'Add for me' }));
  return issue.mock.calls.at(-1)?.[1];
}

describe('AddForMeButton target', () => {
  it('starts its moment again when the subject in focus changes', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = render(
      <AddForMeButton
        row={row('01476107')}
        plan={PLAN}
        kit={KIT}
        allowFull={false}
        t={t}
      />,
    );
    expect(shownAtOfClick()).toBe(1000);
    clock.mockReturnValue(5000);
    act(() => {
      view.rerender(
        <AddForMeButton
          row={row('01476106')}
          plan={PLAN}
          kit={KIT}
          allowFull={false}
          t={t}
        />,
      );
    });
    expect(shownAtOfClick()).toBe(5000);
  });

  it('starts its moment again when it turns to keeping a full section', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = render(
      <AddForMeButton
        row={row('01476107')}
        plan={PLAN}
        kit={KIT}
        allowFull={false}
        t={t}
      />,
    );
    clock.mockReturnValue(5000);
    act(() => {
      view.rerender(
        <AddForMeButton
          row={row('01476107')}
          plan={PLAN}
          kit={KIT}
          allowFull
          t={t}
        />,
      );
    });
    expect(shownAtOfClick()).toBe(5000);
  });

  it('starts its moment again when the helper follows another plan', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = render(
      <AddForMeButton
        row={row('01476107')}
        plan={PLAN}
        kit={KIT}
        allowFull={false}
        t={t}
      />,
    );
    clock.mockReturnValue(5000);
    act(() => {
      view.rerender(
        <AddForMeButton
          row={row('01476107')}
          plan={makePlan({ id: 'plan-2' })}
          kit={KIT}
          allowFull={false}
          t={t}
        />,
      );
    });
    expect(shownAtOfClick()).toBe(5000);
  });

  it('keeps its moment while it adds the same subject the same way', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = render(
      <AddForMeButton
        row={row('01476107')}
        plan={PLAN}
        kit={KIT}
        allowFull={false}
        t={t}
      />,
    );
    clock.mockReturnValue(5000);
    act(() => {
      view.rerender(
        <AddForMeButton
          row={row('01476107')}
          plan={PLAN}
          kit={KIT}
          allowFull={false}
          t={t}
        />,
      );
    });
    expect(shownAtOfClick()).toBe(1000);
  });
});
