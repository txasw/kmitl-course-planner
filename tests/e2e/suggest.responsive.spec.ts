import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  openPlanner,
  pickOption,
  waitForResultsInput,
  submitSearch,
} from './support/fixtures';
import { swipe } from './support/touch';
import { bottomNav, isPhone } from './support/tiers';

// The plan suggestion flow on the phone and tablet projects, on the real by_class
// capture for curriculum 137. The phone shows the suggestions as a bottom sheet that
// pages one card at a time, with a swipe across the card grid and the dots below it;
// the tablet sets the three cards side by side in a dialog. Both apply a card as a new
// plan and find its sections on the timetable with no conflict.

const GRID_BLOCK = '[data-teach-table-id]';

/** Search curriculum 137 from the catalog, the pane on the phone and the sheet on the
 * tablet, and return the container that holds it. */
async function curriculumSearch(page: Page): Promise<Locator> {
  let catalog: Locator;
  if (isPhone(page)) {
    // An empty plan opens the phone on the catalog pane.
    catalog = page.locator('#kcp-catalog-column');
  } else {
    await page.getByRole('button', { name: /^รายวิชา/ }).click();
    catalog = page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
  }
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '05');
  await pickOption(page, 'หลักสูตร', 'ความปลอดภัยไซเบอร์');
  await submitSearch(catalog);
  await expect(catalog.getByText('01006020').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
  return catalog;
}

/** Bring the timetable back into view after the suggestion closes. */
async function showTimetable(page: Page): Promise<void> {
  if (isPhone(page)) {
    await bottomNav(page).getByRole('button', { name: 'ตารางเรียน' }).tap();
    return;
  }
  await page
    .locator('#kcp-catalog-column')
    .getByRole('button', { name: 'ปิดรายการรายวิชา' })
    .click();
}

test('applies a suggested timetable from the compact layouts', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const catalog = await curriculumSearch(page);
  await catalog.getByRole('button', { name: 'แนะนำตาราง' }).click();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await expect(dialog).toBeVisible();
  const apply = dialog.getByRole('button', { name: 'ใช้ตารางนี้' });

  if (isPhone(page)) {
    // One card at a time, paged by a swipe across its grid or by the dots.
    await expect(apply).toHaveCount(1);
    const dots = dialog
      .getByRole('radiogroup', { name: 'ตัวเลือกตาราง' })
      .getByRole('radio');
    await expect(dots).toHaveCount(3);
    const grid = dialog.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    await grid.scrollIntoViewIfNeeded();
    const box = await grid.boundingBox();
    if (box === null) throw new Error('the card grid has no box');
    const y = box.y + box.height / 2;
    await swipe(page, { x: box.x + box.width - 20, y }, { x: box.x + 20, y });
    await expect(
      dialog.getByRole('heading', { name: 'ตัวเลือกที่ 2' }),
    ).toBeVisible();
    await expect(dots.nth(1)).toHaveAttribute('aria-checked', 'true');
    // The card fits the phone: the grid and every meeting on it sit inside the
    // viewport width, so no meeting is out of view.
    const width = page.viewportSize()?.width ?? 0;
    const paged = await grid.boundingBox();
    expect((paged?.x ?? 0) + (paged?.width ?? 0)).toBeLessThanOrEqual(width);
    const blocks = await grid.locator(GRID_BLOCK).all();
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const placed = await block.boundingBox();
      expect(placed?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((placed?.x ?? 0) + (placed?.width ?? 0)).toBeLessThanOrEqual(
        width,
      );
    }
    // Chromium drops a synthetic tap sent straight after a swipe gesture, so the apply
    // that follows the swipe goes through a click.
    await apply.click();
  } else {
    await expect(apply).toHaveCount(3);
    await apply.first().tap();
  }

  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText(/^สร้างตาราง ตาราง \d\/\d{4} สมดุล แล้ว$/),
  ).toBeVisible();
  await showTimetable(page);
  await expect.poll(() => page.locator(GRID_BLOCK).count()).toBeGreaterThan(0);
  await expect(page.locator(`${GRID_BLOCK}[data-verify="danger"]`)).toHaveCount(
    0,
  );
});
