import {
  test,
  expect,
  expandCourse,
  openPlanner,
  pickOption,
  waitForResultsInput,
} from './support/fixtures';
import type { Locator, Page } from '@playwright/test';

// Keyboard focus survives the actions that remove the control holding it. A keyboard add
// collapses the course card and lands on its toggle, a keyboard remove from the block
// details lands on the grid once no block is left, and through both Tab stays inside the
// overlay and Escape still closes it. Each runs on the two docked widths, where the
// catalog column and the grid share the panel.

const OVERLAY_NAME = 'ตัววางแผนตารางเรียน สจล.';
const GRID_NAME = 'ตารางเรียนรายสัปดาห์';
const COURSE = '90592008';

async function categorySearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.getByText(COURSE).first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
}

/** Whether the focused element, read through the shadow root, sits in the node. */
async function holdsFocus(node: Locator): Promise<boolean> {
  return node.evaluate((element) => {
    const root = element.getRootNode();
    return (
      (root instanceof ShadowRoot || root instanceof Document) &&
      root.activeElement !== null &&
      element.contains(root.activeElement)
    );
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test.describe(`at ${String(viewport.width)} by ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('keeps focus in the panel through a keyboard add and remove', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      const overlay = page.getByRole('dialog', { name: OVERLAY_NAME });
      await categorySearch(page);
      await expandCourse(page, COURSE);

      // A keyboard add from the open row collapses the card and lands on its toggle.
      const card = page.locator(`[data-course-card="${COURSE}"]`);
      const toggle = card.locator('[data-course-toggle]');
      const add = card
        .getByRole('button', { name: /^เพิ่ม/ })
        .and(page.locator(':not([aria-disabled="true"])'))
        .first();
      await add.focus();
      await page.keyboard.press('Enter');
      const placed = page.locator('[data-teach-table-id]');
      await expect(placed.first()).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();

      // A keyboard remove from the block details takes the last block away, so focus
      // lands on the grid.
      await placed.first().focus();
      await page.keyboard.press('Enter');
      const remove = page.getByRole('button', { name: 'นำออกจากตาราง' });
      await remove.focus();
      await page.keyboard.press('Enter');
      await expect(placed).toHaveCount(0);
      const grid = page.getByRole('group', { name: GRID_NAME });
      await expect(grid).toBeFocused();

      // Tab and Shift+Tab across the panel's ends stay inside it.
      await page.keyboard.press('Shift+Tab');
      expect(await holdsFocus(overlay)).toBe(true);
      await page.keyboard.press('Tab');
      expect(await holdsFocus(overlay)).toBe(true);
      await page.keyboard.press('Shift+Tab');
      expect(await holdsFocus(overlay)).toBe(true);

      // Escape still reaches the trap and closes the overlay.
      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    });

    test('returns focus to the card toggle after a keyboard remove from the card', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await categorySearch(page);
      await expandCourse(page, COURSE);

      const card = page.locator(`[data-course-card="${COURSE}"]`);
      await card
        .getByRole('button', { name: /^เพิ่ม/ })
        .and(page.locator(':not([aria-disabled="true"])'))
        .first()
        .focus();
      await page.keyboard.press('Enter');
      const placed = page.locator('[data-teach-table-id]');
      await expect(placed.first()).toBeVisible();

      // The card remove takes the section out and hands focus back to the card toggle.
      const cardRemove = card.getByRole('button', { name: /^นำออก/ });
      await cardRemove.focus();
      await page.keyboard.press('Enter');
      await expect(placed).toHaveCount(0);
      await expect(card.locator('[data-course-toggle]')).toBeFocused();

      // The card is addable again, so its keyboard focused toggle previews the course
      // on the grid. The first Escape clears that preview, and the next one still
      // reaches the trap and closes the overlay.
      const overlay = page.getByRole('dialog', { name: OVERLAY_NAME });
      const preview = page.locator('[data-preview]');
      await expect(preview.first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(preview).toHaveCount(0);
      await expect(overlay).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    });
  });
}
