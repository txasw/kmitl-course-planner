import type { Page, Worker } from '@playwright/test';
import { test, expect, gotoSelector, SELECTOR_URL } from './support/fixtures';

// The toolbar icon and its shortcut open the panel (ADR-0062). A browser driven test
// cannot click the toolbar or press a browser command, so each case runs the same
// worker handler through the debug console handle, on the tab the browser reports
// as active, which is the tab a real click would carry.

const OVERLAY_NAME = 'KCP: ตัววางแผนตารางเรียน สจล.';
const LAUNCHER_NAME = 'เปิด KCP: Course Planner for KMITL';

// The debug worker exposes the extension API and the console handle as globals; the
// test describes only the part it calls.
interface WorkerGlobals {
  chrome: {
    tabs: { query(query: { active: boolean }): Promise<{ id?: number }[]> };
  };
  __kcp: { action(tab: { id?: number }): Promise<string> };
}

/** Runs the toolbar click handler for the active tab and returns its outcome. */
async function clickAction(serviceWorker: Worker, page: Page): Promise<string> {
  await page.bringToFront();
  return serviceWorker.evaluate(async () => {
    // Test only assertion: the debug worker carries both globals described above.
    const worker = globalThis as unknown as WorkerGlobals;
    const [tab] = await worker.chrome.tabs.query({ active: true });
    return worker.__kcp.action(tab ?? {});
  });
}

/** Opens a regis tab and waits until its content script is listening. */
async function openRegisTab(page: Page): Promise<Page> {
  await page.goto(SELECTOR_URL);
  await expect(page.getByRole('button', { name: LAUNCHER_NAME })).toBeVisible();
  return page;
}

test('opens the panel in the active regis tab and leaves another closed', async ({
  context,
  serviceWorker,
}) => {
  const first = await gotoSelector(context);
  await expect(
    first.getByRole('button', { name: LAUNCHER_NAME }),
  ).toBeVisible();
  const second = await openRegisTab(await context.newPage());

  expect(await clickAction(serviceWorker, first)).toBe('delivered');
  await expect(first.getByRole('dialog', { name: OVERLAY_NAME })).toBeVisible();
  await expect(second.getByRole('dialog', { name: OVERLAY_NAME })).toHaveCount(
    0,
  );
  expect(context.pages()).toHaveLength(2);
});

test('keeps an open panel open on a second click', async ({
  context,
  serviceWorker,
}) => {
  const page = await gotoSelector(context);
  await page.getByRole('button', { name: LAUNCHER_NAME }).click();
  const overlay = page.getByRole('dialog', { name: OVERLAY_NAME });
  await expect(overlay).toBeVisible();

  expect(await clickAction(serviceWorker, page)).toBe('delivered');
  await expect(overlay).toBeVisible();
});

test('opens the search page with the panel open from a tab on another site', async ({
  context,
  serviceWorker,
}) => {
  const blank = context.pages()[0] ?? (await context.newPage());
  await blank.goto('about:blank');

  const opened = context.waitForEvent('page');
  expect(await clickAction(serviceWorker, blank)).toBe('created');
  const page = await opened;

  await expect(page.getByRole('dialog', { name: OVERLAY_NAME })).toBeVisible();
  expect(page.url()).toBe(SELECTOR_URL);
  expect(context.pages()).toHaveLength(2);
});
