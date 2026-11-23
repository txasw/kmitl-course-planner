import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../../tests/support/domain-builders';
import { createTranslator } from '@/lib/i18n/t';
import { deriveChecklist } from '@/lib/regis/checklist';
import { buildRegistrationKit } from '@/lib/regis/kit';
import type { StopReason } from '@/lib/regis/fillPlan';
import { toSnapshot } from '@/lib/planner/transaction';
import { DEFAULT_FILL_SETTINGS } from '@/lib/storage/regis';
import { regisStore } from '../regisStore';
import { FillPanel } from './FillControls';
import { fillStore } from './fillRun';

// The controls a stopped run offers: each one starts a run that can get past the stop.

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
  marks: null,
  pageTerm: null,
});
const t = createTranslator('en');

function stoppedOn(reason: StopReason) {
  fillStore.setState({
    run: { status: 'stopped', subjectId: SUBJECT, reason, scope: [SUBJECT] },
  });
  render(<FillPanel plan={PLAN} kit={KIT} checklist={CHECKLIST} t={t} />);
}

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

describe('FillPanel after a stop', () => {
  it('offers Continue after a stop the student can clear on the page', () => {
    stoppedOn('fieldNotEmpty');
    expect(
      screen.getByRole('button', { name: 'Continue filling' }),
    ).toBeDefined();
  });

  it('offers only Fill this section anyway after an over subscribed stop', () => {
    stoppedOn('full');
    expect(
      screen.getByRole('button', { name: 'Fill this section anyway' }),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', { name: 'Continue filling' }),
    ).toBeNull();
  });
});
