import {
  test,
  expect,
  editSearch,
  expandCourse,
  openPlanner,
  pickOption,
  waitForResultsInput,
  submitSearch,
} from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import {
  TIERS,
  showCatalogByClick,
  showTimetableByClick,
} from './support/tiers';
import type { JSHandle, Locator, Page } from '@playwright/test';

// Keyboard focus survives the actions that remove the control holding it. A keyboard add
// collapses the course card and lands on its toggle, a keyboard remove from the block
// details lands on the grid once no block is left, and through both Tab stays inside the
// overlay and Escape still closes it. Each runs on the two docked widths, where the
// catalog column and the grid share the panel, and again below them, where the catalog
// is a sheet or a pane. At every tier Tab wraps at the ends of the panel and of the open
// sheet, and Escape closes the innermost open layer first. With the docked column
// hidden, Tab from the header reaches the edge rail before the grid.

const OVERLAY_NAME = 'KCP: ตัววางแผนตารางเรียน สจล.';
const GRID_NAME = 'ตารางเรียนรายสัปดาห์';
// The week grid on the wider tiers and the one day grid on the phone share this prefix.
const ANY_GRID_NAME = /^ตารางเรียน/;
const COURSE = '90592008';

async function categorySearch(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await submitSearch(page);
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

/** The focused element, read through the panel's shadow root. */
async function focusedElement(page: Page): Promise<JSHandle> {
  return page.evaluateHandle(() => {
    const host = Array.from(document.body.children).find(
      (element) => element.shadowRoot !== null,
    );
    return host?.shadowRoot?.activeElement ?? document.activeElement;
  });
}

async function sameElement(a: JSHandle, b: JSHandle): Promise<boolean> {
  return a.evaluate((first, second) => first === second, b);
}

/**
 * Assert Tab wraps at both ends of a trapped container: from the container, Tab lands
 * on its first stop, Shift+Tab from there lands on another stop still inside it, its
 * last, and Tab from that returns to the first.
 */
async function expectTabWraps(page: Page, container: Locator): Promise<void> {
  await container.focus();
  await expect(container).toBeFocused();
  await page.keyboard.press('Tab');
  const first = await focusedElement(page);
  expect(await holdsFocus(container)).toBe(true);
  await page.keyboard.press('Shift+Tab');
  const last = await focusedElement(page);
  expect(await holdsFocus(container)).toBe(true);
  expect(await sameElement(first, last)).toBe(false);
  await page.keyboard.press('Tab');
  expect(await sameElement(await focusedElement(page), first)).toBe(true);
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

    test('reaches the edge rail before the grid by Tab from the header', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await page.getByRole('button', { name: 'ซ่อนรายวิชา' }).click();
      const rail = page.getByRole('button', { name: /^แสดงรายวิชา/ });
      await expect(rail).toBeFocused();

      // The close control ends the header; the next stop is the rail, which stands where
      // the hidden column was, ahead of the plan views and the grid.
      await page.getByRole('button', { name: 'ปิด', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(rail).toBeFocused();
    });
  });
}

for (const tier of TIERS.filter((each) => each.kind !== 'docked')) {
  test.describe(`at the ${tier.name} tier`, () => {
    test.use({ viewport: tier.viewport });

    test('keeps focus in the panel through a keyboard add and remove', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      const overlay = page.getByRole('dialog', { name: OVERLAY_NAME });
      const catalog = await showCatalogByClick(page);
      await categorySearch(page);
      await expandCourse(page, COURSE);

      // A keyboard add from the open row collapses the card and lands on its toggle,
      // with the catalog still open for the next pick.
      const card = page.locator(`[data-course-card="${COURSE}"]`);
      const toggle = card.locator('[data-course-toggle]');
      await card
        .getByRole('button', { name: /^เพิ่ม/ })
        .and(page.locator(':not([aria-disabled="true"])'))
        .first()
        .focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();

      // Tab wraps inside the open sheet on the tablet, and inside the panel on the
      // phone, where the catalog is a pane of the panel.
      await expectTabWraps(page, tier.kind === 'sheet' ? catalog : overlay);

      // A keyboard remove from the block details takes the last block away, so focus
      // lands on the grid.
      await showTimetableByClick(page);
      const placed = page.locator('[data-teach-table-id]');
      await expect(placed.first()).toBeVisible();
      await placed.first().focus();
      await page.keyboard.press('Enter');
      const remove = page.getByRole('button', { name: 'นำออกจากตาราง' });
      await remove.focus();
      await page.keyboard.press('Enter');
      await expect(placed).toHaveCount(0);
      await expect(
        page.getByRole('group', { name: ANY_GRID_NAME }),
      ).toBeFocused();

      await expectTabWraps(page, overlay);
      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    });
  });
}

for (const tier of TIERS) {
  test.describe(`at the ${tier.name} tier`, () => {
    test.use({ viewport: tier.viewport });

    test('wraps Tab at the ends of the panel', async ({ context }) => {
      const page = await openPlanner(context);
      await expectTabWraps(
        page,
        page.getByRole('dialog', { name: OVERLAY_NAME }),
      );
    });

    test('closes the innermost open layer first on Escape', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      const overlay = page.getByRole('dialog', { name: OVERLAY_NAME });
      const catalog = await showCatalogByClick(page);
      await syntheticSearch(page);
      await addCourse(page, '90000001');

      // An open list closes before the search form it sits in.
      await editSearch(page);
      const form = page.locator('#kcp-search-form');
      await expect(form).toHaveAttribute('data-open', 'true');
      await page.getByRole('combobox', { name: 'ปีการศึกษา' }).click();
      const list = page.getByRole('listbox');
      await expect(list).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(list).toHaveCount(0);
      await expect(form).toHaveAttribute('data-open', 'true');

      // The reopened form folds before the sheet or the panel closes.
      await page.keyboard.press('Escape');
      await expect(form).toHaveAttribute('data-open', 'false');
      await expect(overlay).toBeVisible();

      // On the tablet the sheet closes next, alone.
      if (tier.kind === 'sheet') {
        await expect(catalog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(catalog).toBeHidden();
        await expect(overlay).toBeVisible();
      } else {
        await showTimetableByClick(page);
      }

      // The block details and the block context menu each close alone and hand focus
      // back to the block.
      const placed = page.locator(block('900001'));
      await placed.click();
      const details = page.getByRole('dialog', { name: /กลุ่มเรียน/ });
      await expect(details).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(details).toHaveCount(0);
      await expect(placed).toBeFocused();
      await expect(overlay).toBeVisible();

      await placed.click({ button: 'right' });
      const menu = page.getByRole('menu', { name: 'ตัวเลือกบล็อก' });
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(placed).toBeFocused();
      await expect(overlay).toBeVisible();

      // The plan menu closes alone and hands focus back to its switcher.
      const switcher = page
        .locator('header')
        .getByRole('button', { name: 'เลือกตาราง' });
      await switcher.click();
      const create = page.getByRole('button', { name: 'สร้างตาราง' });
      await expect(create).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(create).toHaveCount(0);
      await expect(switcher).toBeFocused();
      await expect(overlay).toBeVisible();

      // With nothing open inside, Escape closes the panel.
      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    });
  });
}
