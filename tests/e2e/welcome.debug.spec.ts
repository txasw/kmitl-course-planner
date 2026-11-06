import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, SELECTOR_URL } from './support/fixtures';
import { axeViolations } from './support/axe';
import { waitForInstallTab } from './support/onboarding';

// The first install as a student meets it (ADR-0062). The fresh profile fires the
// install event, the worker opens the search page in a tab of its own, and that tab
// shows the welcome once. Reloading it, or opening another regis tab, shows no second
// welcome, and Start planning hands over to the panel at the catalog.

test.use({ onboarding: 'fresh' });

const WELCOME = 'ขอบคุณที่ติดตั้ง Course Planner for KMITL';
const START = 'เริ่มวางแผน';
const LAUNCHER = 'เปิด Course Planner for KMITL';
const OVERLAY = 'ตัววางแผนตารางเรียน สจล.';

function selectorTabs(context: BrowserContext): Page[] {
  return context.pages().filter((page) => page.url() === SELECTOR_URL);
}

/** Waits for the install tab and its welcome, and returns the tab. */
async function installTabWithWelcome(context: BrowserContext): Promise<Page> {
  const tab = await waitForInstallTab(context);
  await expect(tab.getByRole('dialog', { name: WELCOME })).toBeVisible();
  return tab;
}

test('shows the welcome once, in the one tab opened on install', async ({
  context,
}) => {
  const tab = await installTabWithWelcome(context);
  expect(selectorTabs(context)).toHaveLength(1);

  const welcome = tab.getByRole('dialog', { name: WELCOME });
  await expect(welcome.getByRole('heading', { name: WELCOME })).toBeVisible();
  await expect(welcome.getByRole('button', { name: START })).toBeFocused();

  // Another regis tab opened while the welcome shows does not show it again.
  const other = await context.newPage();
  await other.goto(SELECTOR_URL);
  await expect(other.getByRole('button', { name: LAUNCHER })).toBeVisible();
  await expect(other.getByRole('dialog')).toHaveCount(0);
  await other.close();

  await tab.bringToFront();
  await expect(welcome).toBeVisible();
  await tab.keyboard.press('Escape');
  await expect(welcome).toHaveCount(0);
  await expect(tab.getByRole('button', { name: LAUNCHER })).toBeFocused();

  await tab.reload();
  await expect(tab.getByRole('button', { name: LAUNCHER })).toBeVisible();
  await expect(tab.getByRole('dialog')).toHaveCount(0);
  expect(selectorTabs(context)).toHaveLength(1);
});

test('opens the panel at the catalog from Start planning', async ({
  context,
}) => {
  const tab = await installTabWithWelcome(context);
  await tab
    .getByRole('dialog', { name: WELCOME })
    .getByRole('button', { name: START })
    .click();

  await expect(tab.getByRole('dialog', { name: WELCOME })).toHaveCount(0);
  await expect(tab.getByRole('dialog', { name: OVERLAY })).toBeVisible();
  await expect(tab.locator('#kcp-catalog-column')).toBeInViewport();
});

test('the welcome passes axe', async ({ context }) => {
  const tab = await installTabWithWelcome(context);
  expect(await axeViolations(tab)).toEqual([]);
});
