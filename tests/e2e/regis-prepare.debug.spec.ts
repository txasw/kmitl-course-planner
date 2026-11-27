import type { Locator, Page } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import {
  planWithKit,
  planWithoutKit,
  storedKitPlans,
} from './support/regisKit';
import { SYNTHETIC_SEARCH } from './support/synthetic';
import type { Replica } from './host/pre_registration/replica.js';

declare global {
  interface Window {
    replica: Replica;
  }
}

// A student who reaches the pre registration page without preparing (ADR-0076): the
// helper's bar says so once and offers Prepare data there, and only there. A press reads
// each planned subject once through the background gateway, stores the kit, and Add for
// me becomes available. The registration page offers no press. The page sends no request
// for it, and nothing on the page is pressed or written.

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const SUBJECTS = ['90000001', '90000003'] as const;

function card(page: Page): Locator {
  return page.locator('#kcp-regis-card');
}

function prepareButton(page: Page): Locator {
  return card(page).getByRole('button', { name: 'เตรียมข้อมูล', exact: true });
}

test('prepares on the pre registration page from the helper, on a press only', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const { term, sections } = await planWithoutKit(
    page,
    serviceWorker,
    SUBJECTS,
  );

  // The registration page, the first come page, offers no press.
  await page.goto(`${REPLICA_URL}#/registration`);
  await page.waitForFunction(() => 'replica' in window);
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('[data-kit-bar]')).toHaveText(
    'ยังไม่ได้เตรียมข้อมูล',
  );
  await expect(prepareButton(page)).toHaveCount(0);

  mock.clearApiCalls();
  await page.goto(`${REPLICA_URL}#/pre_registration`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, catalog }) => {
      window.replica.set({ term: next });
      window.replica.configure({ catalog, xhr: true });
    },
    {
      next: term,
      catalog: Object.fromEntries(
        SUBJECTS.map((id) => [
          id,
          { sections: [{ section: sections[id] ?? '', kind: 'ท' as const }] },
        ]),
      ),
    },
  );
  await expect(card(page)).toBeVisible();
  const bar = card(page).locator('[data-kit-bar]');
  await expect(bar).toContainText('ยังไม่ได้เตรียมข้อมูล');
  // The reason shows once: the bar, with no second note under Add for me.
  await expect(card(page).getByText('ยังไม่ได้เตรียมข้อมูล')).toHaveCount(1);
  await expect(card(page).locator('[data-fill-press]')).toHaveCount(0);

  // Nothing is read before the press.
  await page.waitForTimeout(1000);
  expect(mock.apiCalls()).toEqual([]);

  await prepareButton(page).click();
  // The bar goes once the kit is stored, and Add for me is live.
  await expect(bar).toHaveCount(0, { timeout: 15_000 });
  expect(await storedKitPlans(serviceWorker)).toHaveLength(1);
  expect(mock.apiCalls()).toEqual(SUBJECTS.map(() => 'get-teach-table-show'));
  const add = card(page)
    .getByRole('button', { name: 'เพิ่มให้', exact: true })
    .and(page.locator('[data-fill-press]'));
  await expect(add).toBeVisible();

  // The reads went through the gateway, not the page: the page counted no request of its
  // own, and nothing on it was pressed or written.
  const counters = await page.evaluate(() => ({
    forbidden: window.replica.forbidden(),
    writes: window.replica.counters.writes,
    reads: window.replica.counters.reads,
    interactions: window.replica.interactions(),
  }));
  expect(counters).toEqual({
    forbidden: 0,
    writes: 0,
    reads: 0,
    interactions: 0,
  });

  // Add for me now runs on the kit just prepared.
  await page.waitForTimeout(700);
  await add.click();
  await expect(card(page)).toHaveAttribute('data-fill', 'done', {
    timeout: 15_000,
  });
  const afterFill = await page.evaluate(() => ({
    forbidden: window.replica.forbidden(),
    writes: window.replica.counters.writes,
  }));
  expect(afterFill).toEqual({ forbidden: 0, writes: 0 });
});

test('keeps an 8 day old kit as older data and never fills from it', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const subject = SUBJECTS[0];
  const { term, sections } = await planWithKit(
    page,
    serviceWorker,
    [subject],
    {},
    SYNTHETIC_SEARCH,
    8 * 24 * 60 * 60 * 1000,
  );
  mock.clearApiCalls();
  await page.goto(`${REPLICA_URL}#/pre_registration`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, catalog }) => {
      window.replica.set({ term: next });
      window.replica.configure({ catalog, xhr: true });
    },
    {
      next: term,
      catalog: {
        [subject]: {
          sections: [{ section: sections[subject] ?? '', kind: 'ท' as const }],
        },
      },
    },
  );
  await expect(card(page)).toBeVisible();
  const bar = card(page).locator('[data-kit-bar]');
  await expect(bar).toHaveAttribute('data-kit-bar', 'stale');
  const barText = 'ข้อมูลกลุ่มเรียนเก่ากว่า 7 วัน เตรียมอีกครั้งในเวลาที่ระบบไม่หนาแน่น';
  await expect(bar).toContainText(barText);
  await expect(
    card(page).getByRole('button', { name: 'เตรียมอีกครั้ง', exact: true }),
  ).toBeVisible();

  // The stale kit is no fill input: Add for me reads the bar's words, the one instruction
  // the card gives, and no press can start a run.
  const add = card(page).getByRole('button', { name: 'เพิ่มให้', exact: true });
  await expect(add).toHaveAttribute('aria-disabled', 'true');
  await expect(add).toHaveAccessibleDescription(barText);
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  await page.waitForTimeout(700);
  // The button is aria disabled, so the press is forced past the actionability wait.
  await add.click({ force: true });
  await page.waitForTimeout(500);
  await expect(card(page)).toHaveAttribute('data-fill', 'idle');
  expect(
    await page.evaluate(() => ({
      interactions: window.replica.interactions(),
      writes: window.replica.counters.writes,
    })),
  ).toEqual({ interactions: 0, writes: 0 });
  expect(mock.apiCalls()).toEqual([]);
});
