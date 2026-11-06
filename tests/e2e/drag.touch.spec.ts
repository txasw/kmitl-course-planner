import {
  test,
  expect,
  catalogAtRest,
  expandCourse,
  openPlanner,
  waitForResultsInput,
} from './support/fixtures';
import { denseSubjectId } from './support/denseCatalog';
import { LONG_PRESS_MS, swipe, touchDown, type Point } from './support/touch';
import type { Locator, Page } from '@playwright/test';

// The touch input model of ADR-0058 on a real touch screen. A swipe that starts on a
// drag surface scrolls the catalog, a long press on a section row drags it onto the grid
// and commits, and a tap on a placed block opens its details without the mouse only hover
// card. The touch events go through the Chrome DevTools Protocol helper, so the browser
// runs its own scroll and gesture handling. The tablet keeps the grid beside the catalog
// sheet; on the phone the sheet covers the grid, so these run on the tablet only.

const GRID_BLOCK = '[data-teach-table-id]';
const SCROLLER = '[data-catalog-scroller]';

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'tablet',
    'the touch drags need the grid beside the catalog sheet',
  );
});

// The reserved subject id the mock server answers with the synthetic dense catalog,
// hundreds of collapsed one section courses, so the list is long enough to scroll.
const DENSE_SUBJECT_ID = '90000500';

/** Open the catalog sheet, search the dense catalog, and open its first course card. */
async function denseSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^รายวิชา/ }).click();
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill(DENSE_SUBJECT_ID);
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(
    page.getByText(denseSubjectId(0), { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await waitForResultsInput(page);
  await expandCourse(page, denseSubjectId(0));
}

async function centre(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('expected a laid out element');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function scrollTop(page: Page): Promise<number> {
  return page.locator(SCROLLER).evaluate((node) => node.scrollTop);
}

/** A point on the grid clear of the catalog sheet, which covers the left of the panel. */
async function gridPoint(page: Page): Promise<Point> {
  const sheet = await page.locator('#kcp-catalog-column').boundingBox();
  const grid = await page
    .getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' })
    .boundingBox();
  if (sheet === null || grid === null) throw new Error('expected the layout');
  const left = Math.max(grid.x, sheet.x + sheet.width);
  const right = Math.min(grid.x + grid.width, page.viewportSize()?.width ?? 0);
  return { x: (left + right) / 2, y: grid.y + grid.height / 2 };
}

test('a swipe that starts on a section row scrolls the catalog', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await denseSearch(page);
  const from = await centre(
    page.locator('[data-drag-surface="section"]').first(),
  );
  const before = await scrollTop(page);

  await swipe(page, from, { x: from.x, y: from.y - 240 });

  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 100);
  await expect(page.locator('[data-drag-card]')).toHaveCount(0);
});

test('a swipe that starts on a collapsed course header scrolls the catalog', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await denseSearch(page);
  const header = page
    .locator('[data-drag-surface="course"]')
    .filter({ has: page.locator('[aria-expanded="false"]') })
    .first();
  await header.scrollIntoViewIfNeeded();
  await catalogAtRest(page);
  const from = await centre(header);
  const before = await scrollTop(page);

  await swipe(page, from, { x: from.x, y: from.y - 240 });

  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before + 100);
  await expect(page.locator('[data-drag-card]')).toHaveCount(0);
});

test('a long press on a row drags it onto the grid above the finger and commits', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await denseSearch(page);
  const from = await centre(
    page.locator('[data-drag-surface="section"]').first(),
  );
  const to = await gridPoint(page);

  const finger = await touchDown(page, from);
  try {
    // A long press is defined by elapsed time, so this wait is the gesture itself.
    await page.waitForTimeout(LONG_PRESS_MS);
    await finger.moveTo(to, 12);

    // The grab card is centred over the finger with its bottom edge 32 px above it.
    const card = await page.locator('[data-drag-card]').boundingBox();
    expect(card).not.toBeNull();
    if (card !== null) {
      expect(Math.abs(card.x + card.width / 2 - to.x)).toBeLessThan(4);
      expect(Math.abs(card.y + card.height + 32 - to.y)).toBeLessThan(4);
    }
  } finally {
    await finger.lift();
  }

  await expect(page.locator(GRID_BLOCK)).toHaveCount(1);
});

test('a tap on a placed block opens its details and never the hover card', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await denseSearch(page);
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .tap();
  await page
    .locator('#kcp-catalog-column')
    .getByRole('button', { name: 'ปิดรายการรายวิชา' })
    .tap();

  const block = page.locator(GRID_BLOCK).first();
  await block.tap();

  await expect(page.getByRole('dialog', { name: /กลุ่มเรียน/ })).toBeVisible();
  // The hover card opens after its 400 ms rest; wait past it before reading.
  await page.waitForTimeout(600);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
