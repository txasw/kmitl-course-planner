import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../../tests/support/domain-builders';
import { createTranslator } from '@/lib/i18n/t';
import { deriveChecklist } from '@/lib/regis/checklist';
import { buildRegistrationKit } from '@/lib/regis/kit';
import { toSnapshot } from '@/lib/planner/transaction';
import { DEFAULT_FILL_SETTINGS } from '@/lib/storage/regis';
import { regisStore } from '../regisStore';
import { AddForMeButton, RunProgress } from './FillControls';
import { fillStore } from './fillRun';

// The fill controls: Add for me starts a run only from a trusted press, the progress
// shows the step, and Stop asks the run to end.

const SUBJECT = '01476107';
const COURSE = makeCourse({
  subjectId: SUBJECT,
  sections: [makeSection({ teachTableId: 'T1', subjectId: SUBJECT })],
});
const SECTION = COURSE.sections[0] ?? makeSection();
const PLAN = makePlan({
  entries: [
    makePlanEntry({
      subjectId: SUBJECT,
      teachTableId: SECTION.teachTableId,
      section: SECTION.section,
      snapshot: toSnapshot(COURSE, SECTION),
    }),
  ],
});
const KIT = buildRegistrationKit({
  plan: PLAN,
  results: new Map([
    [
      SUBJECT,
      {
        courses: [COURSE],
        duplicateCount: 0,
        multiMeetingCount: 0,
        warnings: [],
      },
    ],
  ]),
  preparedAt: '2026-11-22T14:10:00.000Z',
});
const CHECKLIST = deriveChecklist({
  plan: PLAN,
  kit: KIT,
  choices: null,
  pageTerm: null,
});
const t = createTranslator('en');

beforeEach(() => {
  for (const name of ['app.454d9e95.js', 'chunk-vendors.7ab4925e.js']) {
    const script = document.createElement('script');
    script.setAttribute('src', `/js/${name}`);
    script.type = 'text/plain';
    document.head.append(script);
  }
  regisStore.setState({ fill: DEFAULT_FILL_SETTINGS });
});

afterEach(() => {
  cleanup();
  document.head.replaceChildren();
  fillStore.setState({ run: { status: 'idle' }, stop: false });
});

const ROW = CHECKLIST.rows[0];

describe('AddForMeButton', () => {
  it('starts nothing from a click the browser did not make', () => {
    if (ROW === undefined) throw new Error('no row');
    render(
      <AddForMeButton
        row={ROW}
        plan={PLAN}
        kit={KIT}
        allowFull={false}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add for me' }));
    expect(fillStore.getState().run.status).toBe('idle');
  });

  it('takes no click from a held key, on the card or on a list row', () => {
    if (ROW === undefined) throw new Error('no row');
    render(
      <>
        <AddForMeButton
          row={ROW}
          plan={PLAN}
          kit={KIT}
          allowFull={false}
          t={t}
        />
        <AddForMeButton
          row={ROW}
          plan={PLAN}
          kit={KIT}
          allowFull={false}
          compact
          t={t}
        />
      </>,
    );
    for (const name of ['Add for me', `Add for me ${SUBJECT}`]) {
      const button = screen.getByRole('button', { name });
      // fireEvent returns false when a listener cancelled the event's default.
      expect(fireEvent.keyDown(button, { key: 'Enter', repeat: true })).toBe(
        false,
      );
      expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true);
    }
    expect(fillStore.getState().run.status).toBe('idle');
  });

  it('names the subject on a compact list row button', () => {
    if (ROW === undefined) throw new Error('no row');
    render(
      <AddForMeButton
        row={ROW}
        plan={PLAN}
        kit={KIT}
        allowFull={false}
        compact
        t={t}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Add for me ${SUBJECT}`,
    });
    expect(button).toHaveAttribute('data-fill-press');
    // The icon alone says what it does in a tooltip on focus and hover.
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Add for me');
  });
});

describe('RunProgress', () => {
  it('shows the step and asks the run to stop', () => {
    render(
      <RunProgress
        run={{
          status: 'running',
          subjectId: SUBJECT,
          step: 'choose',
          prerequisites: [],
          done: 0,
          total: 1,
        }}
        t={t}
      />,
    );
    expect(screen.getByRole('group', { name: 'Step 2 of 3' })).toBeDefined();
    expect(screen.getByText('Pick section')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(fillStore.getState().stop).toBe(true);
  });
});
