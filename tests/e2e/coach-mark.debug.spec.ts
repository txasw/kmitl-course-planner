import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, gotoSelector, SELECTOR_URL } from './support/fixtures';
import { axeViolations } from './support/axe';
import {
  COACH_MARK,
  coachMark,
  expectCoachMarkLaidOut,
  type CoachLanguage,
} from './support/coachMark';
import {
  allowCoachMark,
  seedStorage,
  storedOnboarding,
} from './support/onboarding';
import { localDayStamp } from '../../src/lib/onboarding/coachMark';
import { ENTRY_TOAST_DELAY_MS } from '../../src/lib/onboarding/entryToast';
import { PREFS_KEY } from '../../src/lib/storage/keys';

// The search page coach mark (ADR-0072). A settled context has it away for the day, so
// these specs let it speak before loading a page. It shows on the search route, points at
// the launcher, which stays live through the spotlight, and hides for the visit on Maybe
// later, Escape or the scrim, and for the day on Not again today. A host route change
// away hides it and a change back brings it again. On the search page it speaks in the
// entry prompt's place, and elsewhere the prompt speaks as before. The layout guard runs at the widths
// the owner named, in both languages; set COACH_SHOT_DIR to also keep a screenshot of
// each.

const OVERLAY = 'KCP: ตัววางแผนตารางเรียน สจล.';
const TH = COACH_MARK.th;
const RESULT_HASH =
  '#/teach_table?mode=by_subject_owner_id&selected_year=2569&selected_semester=1&selected_faculty=01&search_all_faculty=false&selected_subject_owner_id=46';
// Past the mount, the onboarding read and the handshake, with room for a cold page.
const SHOW_TIMEOUT_MS = 10_000;
// A quiet stretch longer than the settle, for asserting that the coach mark does not come.
const QUIET_MS = 2500;
// The entrance draws the pointer and pops the burst, all done well inside this.
const ENTRANCE_MS = 1000;

const WIDTHS = [360, 390, 768, 1366] as const;
const HEIGHTS: Record<(typeof WIDTHS)[number], number> = {
  360: 740,
  390: 844,
  768: 1024,
  1366: 768,
};

// The host router navigates with pushState from the page's own world, which fires no
// hashchange and no popstate (ADR-0067), so the specs navigate the same way. The replica
// page has no route view to swap, so this also proves the content script hears the
// Navigation API from its isolated world.
async function navigateHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((next) => {
    window.history.pushState(window.history.state, '', next);
  }, hash);
}

async function openSelector(context: BrowserContext): Promise<Page> {
  await allowCoachMark(context);
  const page = await gotoSelector(context);
  await expect(coachMark(page)).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
  return page;
}

test('shows on the search page with focus on Maybe later, and Escape hides it', async ({
  context,
}) => {
  const page = await openSelector(context);
  const dialog = coachMark(page);
  await expect(dialog).toHaveAttribute('aria-modal', 'false');
  await expect(dialog.getByRole('button', { name: TH.later })).toBeFocused();

  // Tab cycles through the two buttons and the launcher the scrim leaves in reach.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: TH.launcher })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: TH.notToday })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: TH.launcher })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: TH.launcher })).toBeFocused();
  // The host page was never touched: no scroll lock, no class, the route as it was.
  expect(
    await page.evaluate(() => document.body.getAttribute('style') ?? ''),
  ).not.toContain('overflow');
  expect(page.url()).toBe(SELECTOR_URL);
});

test('passes axe', async ({ context }) => {
  const page = await openSelector(context);
  await page.waitForTimeout(ENTRANCE_MS);
  expect(await axeViolations(page)).toEqual([]);
});

test('hides for the visit on Maybe later and comes back on the next visit', async ({
  context,
}) => {
  const page = await openSelector(context);
  await coachMark(page).getByRole('button', { name: TH.later }).click();
  await expect(coachMark(page)).toHaveCount(0);
  await page.waitForTimeout(QUIET_MS);
  await expect(coachMark(page)).toHaveCount(0);

  await navigateHash(page, RESULT_HASH);
  await page.waitForTimeout(QUIET_MS);
  await expect(coachMark(page)).toHaveCount(0);
  await navigateHash(page, '#/teach_table_selector');
  await expect(coachMark(page)).toBeVisible();
});

test('hides when the host navigates away while it shows', async ({
  context,
}) => {
  const page = await openSelector(context);
  await navigateHash(page, RESULT_HASH);
  await expect(coachMark(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: TH.launcher })).toBeFocused();
});

test('hides from a press on the scrim', async ({ context }) => {
  const page = await openSelector(context);
  await page.mouse.click(40, 40);
  await expect(coachMark(page)).toHaveCount(0);
});

test('opens the panel from the spotlit launcher and stays away after it closes', async ({
  context,
}) => {
  const page = await openSelector(context);
  await page.getByRole('button', { name: TH.launcher }).click();
  const overlay = page.getByRole('dialog', { name: OVERLAY });
  await expect(overlay).toBeVisible();
  await expect(coachMark(page)).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  await page.waitForTimeout(QUIET_MS);
  await expect(coachMark(page)).toHaveCount(0);
});

test('stays away for the day after Not again today, across a reload', async ({
  context,
}) => {
  const page = await openSelector(context);
  await coachMark(page).getByRole('button', { name: TH.notToday }).click();
  await expect(coachMark(page)).toHaveCount(0);
  await expect
    .poll(async () => {
      const stored = await storedOnboarding(context);
      return typeof stored === 'object' && stored !== null
        ? (stored as Record<string, unknown>).coachMarkSnoozedOn
        : undefined;
    })
    .toBe(localDayStamp(new Date()));

  await page.reload();
  await expect(page.getByRole('button', { name: TH.launcher })).toBeVisible();
  await page.waitForTimeout(QUIET_MS);
  await expect(coachMark(page)).toHaveCount(0);
});

test('takes the entry prompt place on the search page, and hides it when the host arrives there', async ({
  context,
}) => {
  await allowCoachMark(context, { entryToast: true });
  const page = await gotoSelector(context);
  await expect(coachMark(page)).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
  await page.waitForTimeout(ENTRY_TOAST_DELAY_MS + 1000);
  await expect(page.locator('[data-entry-toast]')).toHaveCount(0);

  // Elsewhere the prompt speaks as before, until the host navigates to the search page.
  await page.goto(new URL('#/', SELECTOR_URL).href);
  await page.reload();
  const toast = page.locator('[data-entry-toast]');
  await expect(toast).toBeVisible({
    timeout: ENTRY_TOAST_DELAY_MS + SHOW_TIMEOUT_MS,
  });
  await expect(coachMark(page)).toHaveCount(0);
  await navigateHash(page, '#/teach_table_selector');
  await expect(coachMark(page)).toBeVisible();
  await expect(toast).toHaveCount(0);
});

for (const language of ['th', 'en'] as const satisfies CoachLanguage[]) {
  test(`lays out with no overlap and no clipped text in ${language}`, async ({
    context,
  }) => {
    await allowCoachMark(context);
    await seedStorage(context, PREFS_KEY, { schemaVersion: 1, language });
    const page = await gotoSelector(context);
    const shotDir = process.env.COACH_SHOT_DIR;
    if (shotDir !== undefined) mkdirSync(shotDir, { recursive: true });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHTS[width] });
      await page.reload();
      await expect(coachMark(page, language)).toBeVisible({
        timeout: SHOW_TIMEOUT_MS,
      });
      await page.waitForTimeout(ENTRANCE_MS);
      await expectCoachMarkLaidOut(page, language);
      if (shotDir !== undefined) {
        await page.screenshot({
          path: join(shotDir, `coach-${language}-${String(width)}.png`),
        });
      }
    }
  });
}
