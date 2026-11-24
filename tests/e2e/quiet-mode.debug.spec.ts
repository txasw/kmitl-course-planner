import type { Page, Worker } from '@playwright/test';
import { ROOT_KEY } from '../../src/lib/storage/keys';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner, SELECTOR_URL } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';

// Quiet mode on the registration pages (ADR-0075). A plan whose entries are due for a
// check and an empty worker cache would make a normal panel open fetch the plan's
// course data and the reference lists. On the pre registration page the same open
// sends nothing: the plan shows from its snapshots, the notice says why, and a search
// the student presses still runs, once. On the search page the open checks as before.

const LAUNCHER = 'เปิด KCP: Course Planner for KMITL';
const MORE = 'เพิ่มเติม';
const OPEN_PLANNER = 'เปิดตารางเรียน';
const PRE_REGISTRATION_URL = `${REGIS_ORIGIN}/#/pre_registration`;
const TEACH_TABLE = 'get-teach-table-show';

// Long enough for the open to have started every automatic request it would send.
const SETTLE_MS = 2_000;

interface StoredRoot {
  plans: {
    entries: { lastVerifiedAt: string | null; verifyStatus: string }[];
  }[];
}

// The debug worker's console handle and the extension storage, as the spec reads them.
interface DebugWorkerGlobals {
  __kcp: { send(message: { type: 'debug/clearCache' }): Promise<unknown> };
  chrome: {
    storage: {
      local: {
        get(key: string): Promise<Record<string, StoredRoot>>;
        set(items: Record<string, StoredRoot>): Promise<void>;
      };
    };
  };
}

/** Build a plan with one placed section and wait until it reaches storage. */
async function placeOneSection(page: Page): Promise<void> {
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();
  // The add runs a check of its own; wait for it so it cannot land after the reset.
  const stats = page.getByRole('group', { name: 'สรุปตาราง', exact: true });
  await expect(stats.getByText(/ตรวจสอบแล้ว/)).toBeVisible({ timeout: 15_000 });
  // Autosave debounces at 300 ms.
  await page.waitForTimeout(500);
}

/** Mark every entry as never checked and empty the worker cache, so an open that is
 * allowed to check has to reach the network. The page leaves the host first, so its
 * plan is saved and the next host page loads a fresh document that reads the edit. */
async function makeCheckDue(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async (key) => {
    // Test only assertion: the debug extension worker carries the globals above.
    const globals = globalThis as unknown as DebugWorkerGlobals;
    const stored = (await globals.chrome.storage.local.get(key))[key];
    if (stored === undefined) throw new Error('no stored plan root');
    for (const plan of stored.plans) {
      for (const entry of plan.entries) {
        entry.lastVerifiedAt = null;
        entry.verifyStatus = 'unverified';
      }
    }
    await globals.chrome.storage.local.set({ [key]: stored });
    await globals.__kcp.send({ type: 'debug/clearCache' });
  }, ROOT_KEY);
}

test('sends nothing on its own on the pre registration page', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await placeOneSection(page);
  await page.goto('about:blank');
  await makeCheckDue(serviceWorker);
  mock.clearApiCalls();

  await page.goto(PRE_REGISTRATION_URL);
  // On the registration pages the helper card opens on its own (ADR-0076), and its more
  // menu opens the full panel; neither step may send a request.
  await page.getByRole('button', { name: MORE }).click();
  await page.getByRole('menuitem', { name: OPEN_PLANNER }).click();
  await expect(page.locator(block('900001'))).toBeVisible();
  await expect(page.locator('[data-quiet-notice]')).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  expect(mock.apiCalls()).toEqual([]);

  // The restored search runs again only on the student's press, as one request.
  await page.getByRole('button', { name: 'ค้นหาอีกครั้ง' }).click();
  await expect(page.getByText('90000001').first()).toBeVisible({
    timeout: 15_000,
  });
  expect(mock.apiCalls()).toEqual([TEACH_TABLE]);
});

test('checks the plan on open on the search page as before', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await placeOneSection(page);
  await page.goto('about:blank');
  await makeCheckDue(serviceWorker);
  mock.clearApiCalls();

  await page.goto(SELECTOR_URL);
  await page.getByRole('button', { name: LAUNCHER }).click();
  await expect(page.locator(block('900001'))).toBeVisible();
  await expect(page.locator('[data-quiet-notice]')).toHaveCount(0);
  await expect.poll(() => mock.apiCalls()).toContain(TEACH_TABLE);
  await expect.poll(() => mock.apiCalls()).toContain('get-faculty');
});
