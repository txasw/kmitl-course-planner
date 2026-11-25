import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { buildRegistrationKit } from '@/lib/regis/kit';
import { toSnapshot } from '@/lib/planner/transaction';
import { Launcher } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from '@/features/plans/planStore';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { fillStore } from './fill/fillRun';
import { hostStore } from './host/hostStore';
import { startVisit } from './helperStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// The helper card passes an axe scan in each of its views, the card, the list, the open
// section menu, and the open more menu, and every motion on it waits for no reduced
// motion preference: the card's rise, the fades, the status colour changes, and the
// loader, which stands still as an open arc under reduced motion.

const SUBJECT = '01476107';
const COURSE = makeCourse({
  subjectId: SUBJECT,
  nameTh: 'การเขียนโปรแกรม',
  nameEn: 'Programming',
  sections: [
    makeSection({ teachTableId: 'T1', subjectId: SUBJECT, section: '1' }),
    makeSection({ teachTableId: 'T2', subjectId: SUBJECT, section: '2' }),
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
  preparedAt: new Date().toISOString(),
});

const css = readFileSync(
  resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
  'utf8',
);

function renderHelper() {
  window.location.hash = '#/pre_registration';
  act(() => {
    planStore.getState().hydrate([PLAN]);
    planStore.getState().setActivePlan(PLAN.id);
  });
  return render(
    <>
      <RegisHelper />
      <Launcher />
    </>,
  );
}

function card() {
  return screen.getByRole('region', { name: 'เช็กลิสต์' });
}

beforeEach(() => {
  regisStore.setState({ kits: [KIT], choices: [] });
  hostStore.setState({ health: { status: 'healthy' }, page: null });
  startVisit();
});

afterEach(() => {
  cleanup();
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  act(() => {
    uiStore.getState().close();
  });
  window.location.hash = '';
});

describe('the helper card, accessibly', () => {
  it('passes axe on the card, the list, the section menu, and the more menu', async () => {
    const view = renderHelper();
    await expectNoSeriousA11yViolations(view.container);

    const count = within(card()).getByRole('button', { name: /^เพิ่มแล้ว/ });
    fireEvent.click(count);
    expect(within(card()).getByRole('list', { name: 'รายวิชา' })).toBeVisible();
    await expectNoSeriousA11yViolations(view.container);
    fireEvent.click(count);

    const tile = within(card()).getByRole('combobox', {
      name: /เลือกกลุ่ม$/,
    });
    fireEvent.click(tile);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await expectNoSeriousA11yViolations(view.container);
    fireEvent.keyDown(tile, { key: 'Escape' });

    fireEvent.click(within(card()).getByRole('button', { name: 'เพิ่มเติม' }));
    expect(screen.getByRole('menu', { name: 'เพิ่มเติม' })).toBeInTheDocument();
    await expectNoSeriousA11yViolations(view.container);
  });

  it('turns the loader only without a reduced motion preference', () => {
    renderHelper();
    act(() => {
      fillStore.setState({
        run: {
          status: 'running',
          subjectId: SUBJECT,
          step: 'enter',
          prerequisites: [],
          done: 0,
          total: 1,
        },
      });
    });
    const chip = within(card()).getByRole('button', {
      name: `${SUBJECT} การเขียนโปรแกรม, กำลังเพิ่ม`,
    });
    const loader = chip.querySelector('svg');
    expect(loader?.getAttribute('class')).toContain('motion-safe:animate-spin');
    expect(loader?.getAttribute('class')).not.toMatch(/(^| )animate-spin/);
    // The status colour changes on the chip and the band stop under reduced motion.
    expect(chip.className).toContain('motion-reduce:transition-none');
    expect(
      within(card()).getByText('กำลังเพิ่ม', { selector: 'span' }).parentElement
        ?.className,
    ).toContain('motion-reduce:transition-none');
  });

  it('rises and fades only without a reduced motion preference', () => {
    const safe = [
      ...css.matchAll(
        /@media \(prefers-reduced-motion: no-preference\) \{\s*\.kcp-regis-card \{([^}]*)\}/g,
      ),
    ];
    expect(safe[0]?.[1]).toContain('animation: kcp-card-in');
    // The card's own rule holds no animation, so it appears in place when reduced.
    const own = /\n\.kcp-regis-card \{([^}]*)\}/.exec(css);
    expect(own?.[1]).not.toContain('animation');
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.kcp-fade-in \{\s*animation: none;/,
    );
  });
});
