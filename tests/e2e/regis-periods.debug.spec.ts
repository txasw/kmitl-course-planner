import type { Locator, Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { planWithKit } from './support/regisKit';
import type {
  Replica,
  ReplicaConfig,
} from './host/pre_registration/replica.js';

// The helper and fill on the replica of the app.a1e43722 route (ADR-0077, ADR-0078),
// whose page wraps the same panel in a header, a ticking period countdown, and a period
// check that polls on a timer and on a focus and can unmount or remount the panel with
// no navigation. The observer reads the page through the new route and follows the panel
// leaving and coming back; a period check that lands in a run stops it as a request of
// the page's own, and the student's next press finishes it. Every spec ends by proving no
// control outside the allowlist got a press or an event, nothing was written, and KCP
// sent no request of its own.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const SUBJECTS = ['90000001', '90000003'] as const;
const [FIRST, SECOND] = SUBJECTS;

function card(page: Page): Locator {
  return page.locator('#kcp-regis-card');
}

function chip(page: Page, subjectId: string): Locator {
  return card(page)
    .getByRole('list', { name: 'รายวิชา' })
    .locator(`[data-status][aria-label^="${subjectId}"]`);
}

/** Plan the subjects, then open the replica served as app.a1e43722. */
async function openRoute(
  page: Page,
  serviceWorker: Worker,
  subjects: readonly string[],
  config: Omit<ReplicaConfig, 'catalog'> = {},
  poll = 0,
): Promise<Record<string, string>> {
  const { term, sections } = await planWithKit(page, serviceWorker, subjects);
  await page.goto(`${REPLICA_URL}?build=a1e43722&poll=${String(poll)}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, options }) => {
      window.replica.set({ term: next });
      window.replica.configure({ ...options, xhr: true });
    },
    {
      next: term,
      options: {
        ...config,
        catalog: Object.fromEntries(
          subjects.map((id) => [
            id,
            { sections: [{ section: sections[id] ?? '', kind: 'ท' as const }] },
          ]),
        ),
      },
    },
  );
  await expect(card(page)).toBeVisible();
  return sections;
}

/** The live Add for me on the card, the one control that issues a student press. */
async function pressAddForMe(page: Page): Promise<void> {
  const button = card(page)
    .getByRole('button', { name: 'เพิ่มให้', exact: true })
    .and(page.locator('[data-fill-press]'));
  await expect(button).toBeVisible();
  await page.waitForTimeout(700);
  await button.click();
}

async function pressAddAll(page: Page): Promise<void> {
  await card(page).getByRole('button', { name: 'เพิ่มเติม' }).click();
  const item = page
    .getByRole('menuitem', { name: 'เพิ่มให้ทุกวิชา' })
    .and(page.locator('[data-fill-press]'));
  await expect(item).toBeVisible();
  await page.waitForTimeout(700);
  await item.click();
}

/** The host's period check fires, as it does when the window gets focus. */
async function focusWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
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

test('reads the page through the new route and follows the panel leaving', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  // The period check runs every second and a half, as often as a spec can watch it.
  const sections = await openRoute(page, serviceWorker, [FIRST], {}, 1500);
  mock.clearApiCalls();
  const status = chip(page, FIRST);
  await expect(card(page)).toHaveAttribute('data-observer', 'healthy');
  await expect(status).toHaveAttribute('data-status', 'todo');

  // The confirm dialog's count line, the list, and the grade dialog's condition read as
  // on the earlier builds, through the header and the countdown above the panel.
  await page.evaluate(() => {
    window.replica.set({ dialog: { kind: 'confirm' } });
  });
  const banner = page.locator('[data-confirm-banner]');
  await expect(banner).toHaveText(
    'หน้าลงทะเบียนมี 0 จาก 1 วิชาตามแผน ตรวจก่อนกดยืนยัน',
  );
  await page.evaluate(
    ({ id, section }) => {
      window.replica.set({ list: [{ subjectId: id, section, kind: 'ท' }] });
    },
    { id: FIRST, section: sections[FIRST] ?? '' },
  );
  await expect(status).toHaveAttribute('data-status', 'added');
  await expect(banner).toHaveCount(0);
  await page.evaluate(
    ({ id, section }) => {
      window.replica.set({
        list: [],
        dialog: { kind: 'grade', subjectId: id, prerequisites: ['90000002'] },
        add: { value: id, sections: [{ section, kind: 'ท' }] },
      });
    },
    { id: FIRST, section: sections[FIRST] ?? '' },
  );
  await expect(card(page)).toContainText('รอเกรด 90000002');
  await page.evaluate(() => {
    window.replica.set({ dialog: null, add: {} });
  });
  await expect(status).toHaveAttribute('data-status', 'todo');

  // Polls ran and the countdown ticked while the helper stayed on the page's reading.
  await page.waitForFunction(() => window.replica.counters.polls >= 2);
  await expect(card(page)).toHaveAttribute('data-observer', 'healthy');

  // The period closes: the panel unmounts, the helper waits, and no Add for me is live.
  await page.evaluate(() => {
    window.replica.set({ period: 'closed' });
  });
  await expect(card(page)).toHaveAttribute('data-observer', 'waiting');
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);

  // It opens again: the panel mounts from its empty data with no navigation, and the
  // helper reads it.
  await page.evaluate(() => {
    window.replica.set({ period: 'open' });
  });
  await expect(card(page)).toHaveAttribute('data-observer', 'healthy');
  await expect(status).toHaveAttribute('data-status', 'todo');
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
  expect(mock.apiCalls()).toEqual([]);
});

test('stops when the period check lands in a run, and a fresh press finishes', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const sections = await openRoute(page, serviceWorker, [FIRST], {
    delay: 3000,
  });
  mock.clearApiCalls();
  await pressAddForMe(page);
  await expect(card(page)).toHaveAttribute('data-fill', 'running');
  // The subject is entered and the host is still reading it when the check fires.
  await page.waitForFunction(() => window.replica.state.add.loading);
  await focusWindow(page);
  const stop = page.locator('[data-fill-stop="pageRequest"]');
  await expect(stop).toHaveText(
    'หน้าลงทะเบียนส่งคำขอของตัวเอง KCP จึงหยุดไว้เพื่อความปลอดภัย กด เพิ่มให้ เพื่อทำต่อ',
    { timeout: 15_000 },
  );
  expect(await listed(page)).toEqual([]);
  expect(
    await page.evaluate(() => window.replica.counters.clicks.add ?? 0),
  ).toBe(0);
  await expect(chip(page, FIRST)).toHaveAttribute('data-status', 'todo');
  await expectNothingForbidden(page);

  // Nothing retries on its own; the student's next press picks the subject up from the
  // field the page kept and finishes it without entering it again.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.replica.counters.reads)).toBe(1);
  await pressAddForMe(page);
  await expect(card(page)).toHaveAttribute('data-fill', 'done', {
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([`${FIRST} ${sections[FIRST] ?? ''}`]);
  expect(await page.evaluate(() => window.replica.counters.reads)).toBe(1);
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});

test('goes on with Add all from the first subject not yet added', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const sections = await openRoute(page, serviceWorker, SUBJECTS, {
    delay: 1500,
  });
  mock.clearApiCalls();
  await pressAddAll(page);
  await expect(card(page)).toHaveAttribute('data-fill', 'running');
  // The first subject is added, and the check fires while the host reads the second.
  await page.waitForFunction(
    (id) =>
      window.replica.state.add.value === id && window.replica.state.add.loading,
    SECOND,
  );
  await focusWindow(page);
  await expect(page.locator('[data-fill-stop="pageRequest"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([`${FIRST} ${sections[FIRST] ?? ''}`]);
  await expect(chip(page, FIRST)).toHaveAttribute('data-status', 'added');
  await expect(chip(page, SECOND)).toHaveAttribute('data-status', 'todo');

  await pressAddAll(page);
  await expect(card(page)).toHaveAttribute('data-fill', 'done', {
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual(
    SUBJECTS.map((id) => `${id} ${sections[id] ?? ''}`),
  );
  // Each subject was entered once: the second run skipped the first and finished the
  // second from the field.
  expect(await page.evaluate(() => window.replica.counters.reads)).toBe(2);
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});

test('stops when the panel unmounts under a run, and fills it once it is back', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const sections = await openRoute(page, serviceWorker, [FIRST], {
    delay: 3000,
  });
  mock.clearApiCalls();
  await pressAddForMe(page);
  await page.waitForFunction(() => window.replica.state.add.loading);
  await page.evaluate(() => {
    window.replica.set({ period: 'closed' });
  });
  await expect(page.locator('[data-fill="stopped"]')).toBeVisible();
  await expect(card(page)).toHaveAttribute('data-observer', 'waiting');
  // The host answers after the panel left, and the run acts on nothing more.
  await page.waitForTimeout(3500);
  expect(await listed(page)).toEqual([]);
  expect(
    Object.keys(await page.evaluate(() => window.replica.counters.untrustedOn)),
  ).toEqual(['subjectField']);
  await expectNothingForbidden(page);

  await page.evaluate(() => {
    window.replica.set({ period: 'open' });
  });
  await expect(card(page)).toHaveAttribute('data-observer', 'healthy');
  // The add card still reads the credits of the mounted panel; a press now waits for it.
  expect(await page.evaluate(() => window.replica.state.add.loading)).toBe(
    true,
  );
  await pressAddForMe(page);
  await expect(card(page)).toHaveAttribute('data-fill', 'done', {
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([`${FIRST} ${sections[FIRST] ?? ''}`]);
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});
