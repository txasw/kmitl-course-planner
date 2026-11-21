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
// capture for curriculum 137. Both show the suggestions one per slide of a carousel, the
// phone in a bottom sheet with a swipe across the slide, the tablet in a dialog. Both
// apply a suggestion as a new plan and find its sections on the timetable with no
// conflict.

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
  const entry = catalog.getByRole('button', { name: 'แนะนำตาราง' });
  // The phone pane's entry and the tablet sheet's are each the only one in reach, the
  // status row being on the timetable pane or behind the modal sheet, so both are filled.
  await expect(entry).toHaveClass(/\bbg-primary-strong\b/);
  await entry.click();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await expect(dialog).toBeVisible();
  const shown = dialog.locator('[data-suggest-slide]:not([inert])');
  const apply = shown.getByRole('button', { name: 'ใช้ตารางนี้' });
  await expect(apply).toHaveCount(1);
  // The first screen of the sheet or dialog shows the start of the first slide and its
  // apply action, with nothing scrolled, once the sheet has slid in.
  const viewportHeight = page.viewportSize()?.height ?? 0;
  await expect
    .poll(async () => {
      const box = await apply.boundingBox();
      return box === null ? Number.POSITIVE_INFINITY : box.y + box.height;
    })
    .toBeLessThanOrEqual(viewportHeight);
  await expect(apply).toBeInViewport({ ratio: 1 });
  const dots = dialog
    .getByRole('group', { name: 'ตัวเลือกตาราง' })
    .getByRole('button');
  await expect(dots).toHaveCount(3);

  if (isPhone(page)) {
    // A finger swipe across the slide brings the next suggestion.
    const grid = shown.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    await grid.scrollIntoViewIfNeeded();
    const box = await grid.boundingBox();
    if (box === null) throw new Error('the slide grid has no box');
    const y = box.y + box.height / 2;
    await swipe(page, { x: box.x + box.width - 20, y }, { x: box.x + 20, y });
    await expect(
      shown.getByRole('heading', { name: 'ตัวเลือกที่ 2' }),
    ).toBeVisible();
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(dialog.getByText('ตัวเลือก 2 จาก 3')).toBeVisible();
    // The slide fits the phone once it settles: the grid and every meeting on it sit
    // inside the viewport width, so no meeting is out of view.
    const width = page.viewportSize()?.width ?? 0;
    const paged = shown.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    await expect
      .poll(async () => {
        const settled = await paged.boundingBox();
        return (settled?.x ?? -1) >= 0 &&
          (settled?.x ?? 0) + (settled?.width ?? 0) <= width
          ? 'inside'
          : 'outside';
      })
      .toBe('inside');
    const blocks = await paged.locator(GRID_BLOCK).all();
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
    await dots.nth(2).tap();
    await expect(
      shown.getByRole('heading', { name: 'ตัวเลือกที่ 3' }),
    ).toBeVisible();
    await apply.tap();
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

test('explains the curriculum search before one ran and opens it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  if (isPhone(page)) {
    await bottomNav(page).getByRole('button', { name: 'ตารางเรียน' }).tap();
  }
  await page
    .getByRole('group', { name: 'สรุปตาราง', exact: true })
    .getByRole('button', { name: 'แนะนำตาราง' })
    .tap();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await expect(dialog).toContainText('ค้นหาตามหลักสูตรก่อน');
  await dialog.getByRole('button', { name: 'ค้นหาตามหลักสูตร' }).tap();
  await expect(dialog).toHaveCount(0);
  const tab = page.getByRole('tab', { name: 'หลักสูตร' });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(tab).toBeFocused();
  await expect(tab).toBeInViewport();
});

test('keeps the suggest action in the thumb zone under the timetable', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await curriculumSearch(page);
  await showTimetable(page);
  const row = page.getByRole('group', { name: 'สรุปตาราง', exact: true });
  const suggest = row.getByRole('button', { name: 'แนะนำตาราง' });
  await expect(suggest).toBeVisible();
  // The row sits at the foot of the plan region, so the action lands in the lower part
  // of the screen a thumb reaches, at the full touch size.
  const box = await suggest.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  if (box === null) throw new Error('the suggest action has no box');
  expect(box.y).toBeGreaterThan(height * 0.6);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await suggest.tap();
  await expect(page.getByRole('dialog', { name: 'แนะนำตาราง' })).toBeVisible();
});
