import type { Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { planWithKit } from './support/regisKit';
import type {
  Replica,
  ReplicaConfig,
} from './host/pre_registration/replica.js';

// Fill on the behaviour replica of the pre registration page (ADR-0078). A student press
// on Add for me on the helper card enters the planned subject, chooses its section
// through the host's own menu, and presses Add, and nothing else. Every spec ends by proving that no control
// outside the allowlist (Continue, the confirm dialog's buttons, the trash icons, the
// links, the pattern table) got a press or an event, that nothing was written, and that
// KCP sent no request of its own. The hostile variants relabel the buttons, dress the
// confirm dialog as the grade dialog, move focus to Continue, submit on Enter, wrap an
// option in a label for Continue, let Add submit a form elsewhere, or serve an untested
// build, and each must end with the fill stopped or never started.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const ADD_FOR_ME = 'เพิ่มให้';
const SUBJECT = '90000001';

async function openReplica(
  page: Page,
  term: { year: string; semester: string },
  config: ReplicaConfig,
  query = '',
): Promise<void> {
  await page.goto(`${REPLICA_URL}${query}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, options }) => {
      window.replica.set({ term: next });
      window.replica.configure({ ...options, xhr: true });
    },
    { next: term, options: config },
  );
  // The helper card opens on its own on each visit (owner answer 5B).
  await expect(page.locator('#kcp-regis-card')).toBeVisible();
}

async function setUp(
  page: Page,
  serviceWorker: Worker,
  config: (section: string) => ReplicaConfig = (section) => ({
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }),
  query = '',
) {
  const { term, sections } = await planWithKit(page, serviceWorker, [SUBJECT]);
  const section = sections[SUBJECT] ?? '';
  await openReplica(page, term, config(section), query);
  return section;
}

/** The live Add for me, the one control that issues a student press. */
function addForMe(page: Page) {
  return page
    .getByRole('button', { name: ADD_FOR_ME, exact: true })
    .and(page.locator('[data-fill-press]'));
}

/** Press Add for me the way a student does, after it has been on screen a moment. */
async function press(page: Page): Promise<void> {
  const button = addForMe(page);
  await expect(button).toBeVisible();
  await page.waitForTimeout(700);
  await button.click();
}

async function expectNothingForbidden(page: Page): Promise<void> {
  const counters = await page.evaluate(() => ({
    forbidden: window.replica.forbidden(),
    writes: window.replica.counters.writes,
    confirm: window.replica.counters.clicks.confirm ?? 0,
    continue: window.replica.counters.clicks.continue ?? 0,
  }));
  expect(counters).toEqual({
    forbidden: 0,
    writes: 0,
    confirm: 0,
    continue: 0,
  });
}

function listed(page: Page) {
  return page.evaluate(() =>
    window.replica.state.list.map((row) => `${row.subjectId} ${row.section}`),
  );
}

test('fills the planned subject on a press and touches nothing else', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const section = await setUp(page, serviceWorker);
  mock.clearApiCalls();
  await press(page);
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([`${SUBJECT} ${section}`]);
  await expect(
    page
      .getByRole('list', { name: 'รายวิชา' })
      .locator(`[data-status][aria-label^="${SUBJECT}"]`),
  ).toHaveAttribute('data-status', 'added');
  const reached = await page.evaluate(
    () => window.replica.counters.untrustedOn,
  );
  expect(Object.keys(reached).sort()).toEqual(
    ['add', 'option', 'sectionSelect', 'subjectField'].sort(),
  );
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});

test('stops on a relabelled Add and presses no Continue', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'continueAsAdd',
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  await press(page);
  await expect(page.locator('[data-fill-stop="notRecognised"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([]);
  await expectNothingForbidden(page);
});

const ACTIVATING_VARIANTS = [
  ['an option wrapped in a label for Continue', 'labelledOption'],
  ['an Add that submits a form elsewhere on the page', 'formAdd'],
] as const;

for (const [name, variant] of ACTIVATING_VARIANTS) {
  test(`stops on ${name} and presses no Continue`, async ({
    context,
    serviceWorker,
  }) => {
    const page = await openPlanner(context);
    await setUp(page, serviceWorker, (section) => ({
      variant,
      catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
    }));
    await press(page);
    await expect(page.locator('[data-fill-stop="notRecognised"]')).toBeVisible({
      timeout: 15_000,
    });
    expect(await listed(page)).toEqual([]);
    await expectNothingForbidden(page);
  });
}

test('ends the run when the student switches fill off', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    delay: 3000,
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  await press(page);
  await expect(page.locator('[data-fill="running"]')).toBeVisible();
  // The subject is entered and the host is still reading it.
  await page.waitForFunction(() => window.replica.state.add.loading);
  await page.getByRole('button', { name: 'เพิ่มเติม' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'ใช้ปุ่มเพิ่มให้' }).click();
  await expect(page.locator('[data-fill="stopped"]')).toBeVisible();
  // The host answers after the switch went off, and the run acts on nothing more.
  await page.waitForTimeout(3500);
  expect(await listed(page)).toEqual([]);
  const reached = await page.evaluate(
    () => window.replica.counters.untrustedOn,
  );
  expect(Object.keys(reached)).toEqual(['subjectField']);
  await expectNothingForbidden(page);
});

const AWAY = [
  ['hides the helper on this page', 'ซ่อนในหน้านี้'],
  ['opens the planner over the page', 'เปิดตารางเรียน'],
] as const;

for (const [name, item] of AWAY) {
  test(`ends the run when the student ${name}`, async ({
    context,
    serviceWorker,
  }) => {
    const page = await openPlanner(context);
    await setUp(page, serviceWorker, (section) => ({
      delay: 3000,
      catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
    }));
    await press(page);
    await expect(page.locator('[data-fill="running"]')).toBeVisible();
    // The subject is entered and the host is still reading it.
    await page.waitForFunction(() => window.replica.state.add.loading);
    await page.getByRole('button', { name: 'เพิ่มเติม' }).click();
    await page.getByRole('menuitem', { name: item }).click();
    await expect(page.locator('#kcp-regis-card')).toHaveCount(0);
    // The host answers after the helper left the page, and the run acts on nothing more.
    await page.waitForTimeout(3500);
    expect(await listed(page)).toEqual([]);
    const reached = await page.evaluate(
      () => window.replica.counters.untrustedOn,
    );
    expect(Object.keys(reached)).toEqual(['subjectField']);
    await expectNothingForbidden(page);
  });
}

test('presses nothing in a confirm dialog dressed as the grade dialog', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'confirmAsGrade',
    catalog: {
      [SUBJECT]: {
        sections: [{ section, kind: 'ท' }],
        prerequisites: ['90000002'],
      },
    },
  }));
  await press(page);
  await expect(page.locator('[data-fill-stop="notRecognised"]')).toBeVisible({
    timeout: 15_000,
  });
  await expectNothingForbidden(page);
});

test('acknowledges the real grade dialog only after showing the condition', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    catalog: {
      [SUBJECT]: {
        sections: [{ section, kind: 'ท' }],
        prerequisites: ['90000002'],
      },
    },
  }));
  await press(page);
  await expect(page.getByText('รอเกรด 90000002')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.acknowledge ?? 0),
  ).toBe(0);
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.acknowledge),
  ).toBe(1);
  await expectNothingForbidden(page);
});

test('leaves the grade dialog alone once the card stops showing the condition', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    catalog: {
      [SUBJECT]: {
        sections: [{ section, kind: 'ท' }],
        prerequisites: ['90000002'],
      },
    },
  }));
  await press(page);
  await expect(page.getByText('รอเกรด 90000002')).toBeVisible({
    timeout: 15_000,
  });
  // The list view hides the focus section that shows the condition.
  await page.getByRole('button', { name: /^เพิ่มแล้ว/ }).click();
  await expect(page.locator('[data-fill="stopped"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.acknowledge ?? 0),
  ).toBe(0);
  expect(await listed(page)).toEqual([]);
  await expectNothingForbidden(page);
});

test('stops when focus moves to Continue', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'focusContinue',
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  await press(page);
  await expect(page.locator('[data-fill-stop="pageChanged"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([]);
  await expectNothingForbidden(page);
});

test('sends no key, so a page that submits on Enter submits nothing', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'enterSubmits',
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  const button = addForMe(page);
  await expect(button).toBeVisible();
  await page.waitForTimeout(700);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.enter ?? 0),
  ).toBe(0);
  await expectNothingForbidden(page);
});

test('offers no fill on an untested host build', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, undefined, '?build=untested');
  await expect(page.locator('[data-observer="off"]')).toBeVisible();
  // Add for me shows disabled with its reason, and no control that issues a press exists.
  await expect(
    page.getByRole('button', { name: ADD_FOR_ME, exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
});
