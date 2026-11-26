import type { Locator, Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { planWithKit } from './support/regisKit';
import { swipe, tap } from './support/touch';
import type { Replica } from './host/pre_registration/replica.js';

declare global {
  interface Window {
    replica: Replica;
  }
}

// Add for me on a phone with a touch screen (ADR-0078): a stray touch is no reason to
// stop. Taps on the host page, a scroll of it, a tap on its header, and taps on the card's
// count and on the launcher while Add all for me runs leave the card open, Stop on screen,
// and the run going until every subject is added; Stop still stops at once. The host's
// period check runs every second, as well as on a focus and a visibility change, and lands
// in the run without stopping it (owner ruling of 2026-11-26). The run presses nothing
// outside its allowlist and writes nothing.

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const SUBJECTS = ['90000001', '90000003', '90000005'] as const;
const PHONE = { width: 412, height: 915 };

test.use({ isMobile: true, hasTouch: true });

function card(page: Page): Locator {
  return page.locator('#kcp-regis-card');
}

/**
 * Plan at the planner's desktop size, then open the a1e43722 route at a phone size, its
 * period check running every second.
 */
async function openOnPhone(
  page: Page,
  serviceWorker: Worker,
  delay: number,
  size: { width: number; height: number } = PHONE,
): Promise<void> {
  const { term, sections } = await planWithKit(page, serviceWorker, SUBJECTS);
  await page.setViewportSize(size);
  await page.goto(`${REPLICA_URL}?build=a1e43722&poll=1000#/pre_registration`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, catalog, wait }) => {
      window.replica.set({ term: next });
      window.replica.configure({ catalog, xhr: true, delay: wait });
    },
    {
      next: term,
      wait: delay,
      catalog: Object.fromEntries(
        SUBJECTS.map((id) => [
          id,
          { sections: [{ section: sections[id] ?? '', kind: 'ท' as const }] },
        ]),
      ),
    },
  );
  // On a phone the card starts behind the launcher; the student opens it.
  const launcher = page.locator('#kcp-launcher');
  await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  const box = await launcher.boundingBox();
  if (box === null) throw new Error('no launcher');
  await tap(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect(card(page)).toBeVisible();
}

/** Tap Add all for me in the more menu, after it has been on screen a moment. */
async function startAddAll(page: Page): Promise<void> {
  await card(page).getByRole('button', { name: 'เพิ่มเติม' }).tap();
  const item = page
    .getByRole('menuitem', { name: 'เพิ่มให้ทุกวิชา' })
    .and(page.locator('[data-fill-press]'));
  await expect(item).toBeVisible();
  await page.waitForTimeout(700);
  await item.tap();
  await expect(card(page)).toHaveAttribute('data-fill', 'running');
}

/**
 * A point on the host page, in the middle of a host element, outside KCP. The period
 * check renders the periods section again on each run, so the element can be between two
 * renders at the moment it is read; the box is read again until one is there.
 */
async function centreOf(page: Page, selector: string) {
  const element = page.locator(selector).first();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const box = await element.boundingBox();
    if (box !== null) {
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`no ${selector}`);
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

test('a tap, a scroll, and a tap on the header mid run leave Add all for me running', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await openOnPhone(page, serviceWorker, 900);
  await startAddAll(page);

  // A tap on the page's countdown, as a stray touch does.
  await tap(page, await centreOf(page, '.registration-periods'));
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAttribute('data-fill', 'running');

  // A scroll of the page, its finger starting on the page outside the card.
  const from = await centreOf(page, '.registration-header');
  await swipe(page, from, { x: from.x, y: from.y - 120 });
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveAttribute('data-fill', 'running');

  // A tap on the page's header title.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await tap(page, await centreOf(page, '.registration-header h1'));
  await expect(card(page)).toBeVisible();

  // A tap on the card's count keeps the card view, with the step progress and Stop.
  await tap(page, await centreOf(page, '#kcp-regis-count'));
  await expect(page.locator('#kcp-regis-list')).toHaveCount(0);
  await expect(page.locator('#kcp-regis-stop')).toBeVisible();

  // A tap on the launcher, where a thumb rests, keeps the card open and the run going.
  await tap(page, await centreOf(page, '#kcp-launcher'));
  await expect(card(page)).toBeVisible();
  await expect(page.locator('#kcp-regis-stop')).toBeVisible();

  await expect(card(page)).toHaveAttribute('data-fill', 'done', {
    timeout: 30_000,
  });
  const listed = await page.evaluate(() =>
    window.replica.state.list.map((row) => row.subjectId),
  );
  expect(listed).toEqual([...SUBJECTS]);
  // The period check ran through the run and stopped nothing.
  expect(
    await page.evaluate(() => window.replica.counters.polls),
  ).toBeGreaterThanOrEqual(3);
  await expectNothingForbidden(page);
});

test('Stop still stops the run at once on a phone', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await openOnPhone(page, serviceWorker, 3000);
  await startAddAll(page);
  await page.waitForFunction(() => window.replica.state.add.loading);
  await page.locator('#kcp-regis-stop').tap();
  await expect(page.locator('[data-fill-stop="stopped"]')).toBeVisible();
  await expect(card(page)).toHaveAttribute('data-fill', 'stopped');
  // The host answers after the stop, and the run acts on nothing more.
  await page.waitForTimeout(3500);
  const listed = await page.evaluate(() => window.replica.state.list.length);
  expect(listed).toBe(0);
  await expectNothingForbidden(page);
});

// A phone turned on its side is 915 px wide, so it is no narrow screen by width, yet only
// 412 px tall: the card starts folded, and opened it shows its subject whole, with no part
// of the queue or the subject cut off or under the action row or the launcher.
test('a phone on its side starts folded and opens with nothing cut off', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await openOnPhone(page, serviceWorker, 900, { width: 915, height: 412 });
  const scroller = card(page).locator('.kcp-scroll');
  const fits = await scroller.evaluate(
    (node) => node.scrollHeight <= node.clientHeight + 1,
  );
  expect(fits).toBe(true);
  const add = card(page)
    .getByRole('button', { name: 'เพิ่มให้', exact: true })
    .first();
  const addBox = await add.boundingBox();
  const launcherBox = await page.locator('#kcp-launcher').boundingBox();
  if (addBox === null || launcherBox === null) throw new Error('no box');
  expect(addBox.y + addBox.height).toBeLessThanOrEqual(launcherBox.y);
  const cardBox = await card(page).boundingBox();
  if (cardBox === null) throw new Error('no card');
  expect(cardBox.y).toBeGreaterThanOrEqual(0);
});
