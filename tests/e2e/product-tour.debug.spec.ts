import type { BrowserContext } from '@playwright/test';
import { onboardingRecordSchema } from '../../src/lib/storage/onboarding';
import { axeViolations } from './support/axe';
import { test, expect, gotoSelector, openPlanner } from './support/fixtures';
import {
  allowProductTour,
  storedOnboarding,
  waitForInstallTab,
} from './support/onboarding';
import {
  TOUR,
  expectAddStepOnSearchFields,
  tourCard,
  walkTour,
  type TourStepName,
} from './support/tour';
import {
  chooseLanguage,
  openTourFromMenu,
  searchCurriculum,
} from './support/tourSetup';

// The first run product tour on a desktop (ADR-0074). It starts once the welcome's
// Start planning opens the panel, and once for a student who installed before it
// existed; Escape skips it, Finish ends it on the export button, and either way it is
// recorded so it stays away. The overflow menu opens it again. Every step passes the
// layout guard: the card covers neither its spotlight nor its own text, in both
// languages, at the default desktop size and at 1366 by 768.

const WELCOME = 'ขอบคุณที่ติดตั้ง KCP: Course Planner for KMITL';
const OVERLAY = 'KCP: ตัววางแผนตารางเรียน สจล.';
const LAUNCHER = 'เปิด KCP: Course Planner for KMITL';

// Before any search there is no query chip and no course, so the tour points at the
// search tabs and then the search fields, saying sections show after a search; the status
// row's suggest action is there before any search, so the first run walks every step too.
const FULL_STEPS: readonly TourStepName[] = [
  'search',
  'add',
  'timetable',
  'suggest',
  'export',
];

// Longer than the tour's settle before it opens, so a spec that checks it stays away
// waits past the moment it would have opened.
const QUIET_MS = 1500;

/** How the stored tour mark says the tour ended, read through the product schema. */
async function storedOutcome(
  context: BrowserContext,
): Promise<string | undefined> {
  const parsed = onboardingRecordSchema.safeParse(
    await storedOnboarding(context),
  );
  return parsed.success ? parsed.data.tourSeen?.outcome : undefined;
}

test.describe('after install', () => {
  test.use({ onboarding: 'fresh' });

  test('starts after Start planning, walks to Finish, and stays away after', async ({
    context,
  }) => {
    const tab = await waitForInstallTab(context);
    const welcome = tab.getByRole('dialog', { name: WELCOME });
    await expect(welcome).toBeVisible();
    await welcome.getByRole('button', { name: 'เริ่มวางแผน' }).click();

    const card = tourCard(tab);
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('button', { name: TOUR.th.next }),
    ).toBeFocused();
    await walkTour(tab, 'th', FULL_STEPS, async (step) => {
      if (step === 'add') await expectAddStepOnSearchFields(tab, 'th');
    });
    await card.getByRole('button', { name: TOUR.th.finish }).click();
    await expect(card).toHaveCount(0);
    await expect(tab.locator('#kcp-export-entry')).toBeFocused();
    await expect.poll(() => storedOutcome(context)).toBe('completed');

    await tab.reload();
    await tab.getByRole('button', { name: LAUNCHER }).click();
    await expect(tab.getByRole('dialog', { name: OVERLAY })).toBeVisible();
    await tab.waitForTimeout(QUIET_MS);
    await expect(card).toHaveCount(0);
  });
});

test('starts once for a student who installed before it, and Escape skips it', async ({
  context,
}) => {
  await allowProductTour(context);
  const page = await openPlanner(context);
  const card = tourCard(page);
  await expect(card).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: OVERLAY })).toBeVisible();
  await expect(
    page.getByText('เปิดดูการแนะนำการใช้งานอีกครั้งได้จากเมนูตัวเลือกเพิ่มเติม'),
  ).toBeVisible();
  await expect.poll(() => storedOutcome(context)).toBe('skipped');
});

test('stays away for a student who walked it', async ({ context }) => {
  const page = await openPlanner(context);
  await expect(page.getByRole('dialog', { name: OVERLAY })).toBeVisible();
  await page.waitForTimeout(QUIET_MS);
  await expect(tourCard(page)).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
]) {
  test(`walks every step from the menu at ${String(viewport.width)} px in both languages`, async ({
    context,
  }) => {
    const page = await gotoSelector(context);
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: LAUNCHER }).click();
    await searchCurriculum(page);

    await openTourFromMenu(page, 'th');
    await walkTour(page, 'th', FULL_STEPS);
    await tourCard(page).getByRole('button', { name: TOUR.th.finish }).click();

    await chooseLanguage(page, 'th', 'en');
    await openTourFromMenu(page, 'en');
    await walkTour(page, 'en', FULL_STEPS);
    // Back returns a step, and Skip ends the tour from anywhere.
    await tourCard(page).getByRole('button', { name: TOUR.en.back }).click();
    await expect(tourCard(page).getByRole('heading')).toHaveText(
      TOUR.en.titles.suggest,
    );
    await tourCard(page).getByRole('button', { name: TOUR.en.skip }).click();
    await expect(tourCard(page)).toHaveCount(0);
  });
}
