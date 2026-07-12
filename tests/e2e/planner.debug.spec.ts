import { test, expect, openPlanner, pickOption } from './support/fixtures';
import type { Page } from '@playwright/test';

// A grid block carries a data-teach-table-id; the catalog rows do not, so this
// selector targets placed blocks only. The debug build mounts an open shadow root,
// so Playwright pierces it to reach these nodes.
const GRID_BLOCK = '[data-teach-table-id]';

// Run the owner 32 category search that the catalog specs use, so the catalog
// renders the deduped courses with at least one open, addable section.
async function categorySearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
}

test('adds a section from its button, then removes it with undo', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);

  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();

  await page
    .getByRole('button', { name: 'นำออก', exact: true })
    .first()
    .click();
  await expect(page.locator(GRID_BLOCK)).toHaveCount(0);

  await page.getByRole('button', { name: 'เลิกทำ' }).click();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

test('places a section on the grid by dragging its handle', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);

  // The whole section row is the pointer drag source now, not only the grip, so grab the
  // row surface. The grip stays the keyboard commit anchor, covered by the next test.
  const handle = page.locator('[data-drag-surface="section"]').first();
  const grid = page.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
  const from = await handle.boundingBox();
  const to = await grid.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  if (from === null || to === null) {
    return;
  }

  // A raw pointer sequence drives the real dnd-kit pointer sensor: press the grip,
  // move past the activation distance, then onto the grid, and release. The pointer
  // within collision resolves the drop zone and the placement commits.
  const pointerX = to.x + to.width / 2;
  const pointerY = to.y + to.height / 2;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
  await page.mouse.move(pointerX, pointerY, { steps: 15 });

  // While the drag is live, the grab card's top-left tracks the pointer within a few
  // pixels. Before the snap-to-cursor modifier it floated above the pointer by half a
  // catalog row, so this guards the G1 regression.
  const card = await page.locator('[data-drag-card]').boundingBox();
  expect(card).not.toBeNull();
  if (card !== null) {
    expect(Math.abs(card.x - pointerX)).toBeLessThan(16);
    expect(Math.abs(card.y - pointerY)).toBeLessThan(16);
  }

  await page.mouse.up();

  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

test('commits a section from the grip with the keyboard', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);

  // Focus the grip and press Enter: the grip commits like the add button, since
  // arrow key movement was removed.
  await page
    .getByRole('button', { name: /ลากเพื่อเพิ่ม/ })
    .first()
    .focus();
  await page.keyboard.press('Enter');

  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

test('places a section by dragging the course onto a candidate slot', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);

  const courseHandle = page.locator('[data-drag-surface="course"]').first();
  const from = await courseHandle.boundingBox();
  if (from === null) {
    throw new Error('missing course handle');
  }

  // Press the course grip and move past the activation distance so the grid paints
  // the candidate slots, then drop onto the first valid slot to commit that section.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });

  const slot = page.locator('[data-candidate="valid"]').first();
  await slot.waitFor();
  const to = await slot.boundingBox();
  if (to === null) {
    throw new Error('missing candidate slot');
  }
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 15,
  });
  await page.mouse.up();

  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

test('lists an added unscheduled course on the shelf', async ({ context }) => {
  const page = await openPlanner(context);
  // The by_class all curricula path surfaces the unscheduled online course 01006029.
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '08');
  await pickOption(page, 'หลักสูตร', 'ทุกหลักสูตร');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('01006029').first()).toBeVisible({
    timeout: 15_000,
  });

  const onlineCard = page
    .getByRole('article')
    .filter({ hasText: '01006029' })
    .first();
  await onlineCard.getByRole('button', { name: /^เพิ่ม/ }).click();

  const shelf = page.getByRole('region', { name: 'รายวิชาที่ไม่มีคาบเรียน' });
  await expect(shelf).toBeVisible();
  await expect(shelf.getByText('01006029')).toBeVisible();
});

test('opens a block detail popover and removes the section through it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);

  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  const block = page.locator(GRID_BLOCK).first();
  await expect(block).toBeVisible();

  // The block carries a details control alongside its remove control. Opening it
  // mounts the popover anchored to the block; the overlay itself is also a dialog,
  // so the popover is identified by the floating element marker.
  await block.getByRole('button', { name: 'รายละเอียด' }).click();
  const popover = page.locator('[data-floating-ui-focusable]');
  await expect(popover).toBeVisible();

  // Removing through the popover clears the block, the same path as the block's own
  // remove control, and closes the popover.
  await popover.getByRole('button', { name: 'นำออก', exact: true }).click();
  await expect(page.locator(GRID_BLOCK)).toHaveCount(0);
  await expect(popover).toHaveCount(0);
});

test('preview removes the mutating controls and keeps the grid', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();

  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();

  await expect(page.getByRole('button', { name: /^เพิ่ม/ })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'นำออก', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});
