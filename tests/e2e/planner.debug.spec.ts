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

// The pointer drag itself is not exercised here: dnd-kit's PointerSensor uses
// pointer capture rather than HTML5 drag, which headless Playwright does not drive
// reliably, so the drag validation, ghosts, reason chip, and blocked strip are
// covered by component tests and the manual QA script instead. The add commit path
// the drag shares is proven by the button add above.
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
