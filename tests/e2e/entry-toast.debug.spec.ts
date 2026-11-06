import type { Page } from '@playwright/test';
import { test, expect, gotoSelector } from './support/fixtures';
import {
  allowEntryToast,
  storedOnboarding,
  waitForInstallTab,
} from './support/onboarding';
import {
  ENTRY_TOAST_DELAY_MS,
  ENTRY_TOAST_VISIBLE_MS,
} from '../../src/lib/onboarding/entryToast';

// The entry toast beside the launcher (ADR-0063). A settled context has the prompt turned
// off, so these specs turn it back on before loading a page. With no plan stored the
// prompt names the planner and opens it at the catalog. Do not show again keeps it away
// on the next load. On the install visit the welcome speaks first and the prompt stays
// quiet, and it appears on the next load instead.

const NO_PLAN =
  'ใช้ Planner วางแผนตารางเรียนจากรายวิชาที่เปิดสอนในเว็บไซต์นี้ได้';
const OPEN_PLANNER = 'เปิด Planner';
const OPT_OUT = 'ไม่ต้องแสดงข้อความนี้อีก';
const WELCOME = 'ขอบคุณที่ติดตั้ง Course Planner for KMITL';
const LAUNCHER = 'เปิด Course Planner for KMITL';
const OVERLAY = 'ตัววางแผนตารางเรียน สจล.';

// Past the settle and the delay, with room for a cold page to mount.
const SHOW_TIMEOUT_MS = ENTRY_TOAST_DELAY_MS + 8000;
// A quiet stretch longer than the delay, for asserting that the prompt does not come.
const QUIET_MS = ENTRY_TOAST_DELAY_MS + 1000;

function entryToast(page: Page) {
  return page.locator('[data-entry-toast]');
}

test.describe('with the prompt on', () => {
  test.beforeEach(async ({ context }) => {
    await allowEntryToast(context);
  });

  test('names the planner on the selector and opens it at the catalog', async ({
    context,
  }) => {
    const page = await gotoSelector(context);
    const toast = entryToast(page);
    await expect(toast).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
    await expect(toast).toContainText(NO_PLAN);
    await expect(toast).toBeInViewport({ ratio: 1 });

    await toast.getByRole('button', { name: OPEN_PLANNER }).click();
    await expect(page.getByRole('dialog', { name: OVERLAY })).toBeVisible();
    await expect(page.locator('#kcp-catalog-column')).toBeInViewport();
    await expect(toast).toHaveCount(0);
  });

  test('stays away after Do not show again, across a reload', async ({
    context,
  }) => {
    const page = await gotoSelector(context);
    const toast = entryToast(page);
    await expect(toast).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
    await toast.getByRole('button', { name: OPT_OUT }).click();
    await expect(toast).toHaveCount(0);
    await expect(page.getByRole('button', { name: LAUNCHER })).toBeFocused();
    await expect
      .poll(async () => {
        const stored = await storedOnboarding(context);
        return typeof stored === 'object' && stored !== null
          ? 'entryToastOptOutAt' in stored
          : false;
      })
      .toBe(true);

    await page.reload();
    await expect(page.getByRole('button', { name: LAUNCHER })).toBeVisible();
    // A negative check has no event to wait for, so it outlasts the delay.
    await page.waitForTimeout(QUIET_MS);
    await expect(toast).toHaveCount(0);
  });

  test('hides by itself after its time on screen', async ({ context }) => {
    const page = await gotoSelector(context);
    const toast = entryToast(page);
    await expect(toast).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
    await expect(toast).toHaveCount(0, {
      timeout: ENTRY_TOAST_VISIBLE_MS + 2000,
    });
  });
});

test.describe('on a fresh install', () => {
  test.use({ onboarding: 'fresh' });

  test('the install tab shows the welcome and no prompt, and a reload shows it', async ({
    context,
  }) => {
    const tab = await waitForInstallTab(context);
    const welcome = tab.getByRole('dialog', { name: WELCOME });
    await expect(welcome).toBeVisible();
    const toast = entryToast(tab);
    await expect(toast).toHaveCount(0);

    await tab.keyboard.press('Escape');
    await expect(welcome).toHaveCount(0);
    // The document found the welcome pending at load, so it stays quiet after it.
    await tab.waitForTimeout(3000);
    await expect(toast).toHaveCount(0);

    await tab.reload();
    await expect(toast).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
    await expect(toast).toContainText(NO_PLAN);
    await expect(tab.getByRole('dialog')).toHaveCount(0);
  });
});
