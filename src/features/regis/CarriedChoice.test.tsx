import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { toSnapshot } from '@/lib/planner/transaction';
import { withChoice } from '@/lib/regis/choices';
import { buildRegistrationKit } from '@/lib/regis/kit';
import { INITIAL_HEALTH } from '@/lib/regis/observerHealth';
import { Launcher } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from '@/features/plans/planStore';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { fillStore } from './fill/fillRun';
import { helperStore, setCollapsed, startVisit } from './helperStore';
import { hostStore } from './host/hostStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// A section chosen on pre registration is kept per plan and term, so regular registration
// shows it as the plan's choice and says it was chosen for pre registration (owner
// answer C1), until the student chooses again on that page. Pre registration shows no
// such label.

const SUBJECT = '01476201';
const COURSE = makeCourse({
  subjectId: SUBJECT,
  nameTh: 'โครงสร้างข้อมูล',
  sections: [
    makeSection({ teachTableId: 'S1', subjectId: SUBJECT, section: '1' }),
    makeSection({ teachTableId: 'S2', subjectId: SUBJECT, section: '2' }),
    makeSection({ teachTableId: 'S3', subjectId: SUBJECT, section: '3' }),
  ],
});
const PLANNED = COURSE.sections[0] ?? makeSection();
const PLAN = makePlan({
  entries: [
    makePlanEntry({
      subjectId: SUBJECT,
      teachTableId: PLANNED.teachTableId,
      section: PLANNED.section,
      snapshot: toSnapshot(COURSE, PLANNED),
    }),
  ],
});
const LABEL = 'เลือกไว้สำหรับลงทะเบียนล่วงหน้า';

function renderOn(hash: string) {
  window.location.hash = hash;
  const kit = buildRegistrationKit({
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
    preparedAt: new Date().toISOString(),
  });
  act(() => {
    planStore.getState().hydrate([PLAN]);
    planStore.getState().setActivePlan(PLAN.id);
    regisStore.setState({
      kits: [kit],
      choices: [withChoice(null, PLAN, SUBJECT, ['S2'])],
    });
  });
  render(
    <>
      <RegisHelper />
      <Launcher />
    </>,
  );
  act(() => {
    setCollapsed(false);
  });
  return screen.getByRole('region', { name: 'เช็กลิสต์' });
}

function chosenOption() {
  return within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .find((option) => option.getAttribute('aria-selected') === 'true');
}

beforeEach(() => {
  regisStore.setState({ kits: [], choices: [] });
  hostStore.setState({
    health: { status: 'healthy' },
    page: null,
    term: { year: '2569', semester: '1' },
  });
  helperStore.setState({ chosen: null });
  startVisit();
});

afterEach(() => {
  cleanup();
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  act(() => {
    uiStore.getState().close();
    hostStore.setState({ health: INITIAL_HEALTH, page: null, term: null });
  });
  window.location.hash = '';
});

describe('a section chosen on pre registration', () => {
  it('shows on regular registration, labelled as chosen for pre registration', () => {
    const card = renderOn('#/registration');
    expect(card.querySelector('[data-carried-choice]')).toHaveTextContent(
      LABEL,
    );
    const tile = within(card).getByRole('combobox');
    expect(tile).toHaveAccessibleName(/2/);
    fireEvent.click(tile);
    const option = chosenOption();
    expect(option).toHaveTextContent('2');
    expect(option).toHaveTextContent(LABEL);
  });

  it('drops the label once the student chooses again on regular registration', () => {
    const card = renderOn('#/registration');
    fireEvent.click(within(card).getByRole('combobox'));
    const third = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.textContent.includes('3'));
    if (third === undefined) throw new Error('no third section');
    fireEvent.mouseDown(third);
    expect(card.querySelector('[data-carried-choice]')).toBeNull();
    fireEvent.click(within(card).getByRole('combobox'));
    expect(chosenOption()).toHaveTextContent('3');
    expect(chosenOption()).not.toHaveTextContent(LABEL);
  });

  it('carries no label on pre registration, where it was chosen', () => {
    const card = renderOn('#/pre_registration');
    expect(card.querySelector('[data-carried-choice]')).toBeNull();
    fireEvent.click(within(card).getByRole('combobox'));
    expect(chosenOption()).toHaveTextContent('2');
    expect(chosenOption()).not.toHaveTextContent(LABEL);
  });
});
