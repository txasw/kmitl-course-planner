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
    .getByRole('button', { name: 'เพิ่ม', exact: true })
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

  const handle = page.getByRole('button', { name: /ลากเพื่อเพิ่ม/ }).first();
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
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
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
  await onlineCard.getByRole('button', { name: 'เพิ่ม', exact: true }).click();

  const shelf = page.getByRole('region', { name: 'รายวิชาที่ไม่มีคาบเรียน' });
  await expect(shelf).toBeVisible();
  await expect(shelf.getByText('01006029')).toBeVisible();
});

test('preview removes the mutating controls and keeps the grid', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);
  await page
    .getByRole('button', { name: 'เพิ่ม', exact: true })
    .first()
    .click();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();

  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();

  await expect(
    page.getByRole('button', { name: 'เพิ่ม', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'นำออก', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});
