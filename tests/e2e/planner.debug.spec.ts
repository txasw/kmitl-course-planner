import {
  test,
  expect,
  expandCourse,
  openPlanner,
  pickOption,
  waitForResultsInput,
  submitSearch,
} from './support/fixtures';
import { denseSubjectId } from './support/denseCatalog';
import type { Page } from '@playwright/test';

// A grid block carries a data-teach-table-id; the catalog rows do not, so this
// selector targets placed blocks only. The debug build mounts an open shadow root,
// so Playwright pierces it to reach these nodes.
const GRID_BLOCK = '[data-teach-table-id]';
const GRID_NAME = 'ตารางเรียนรายสัปดาห์';

// Run the owner 32 category search that the catalog specs use, so the catalog
// renders the deduped courses, every card collapsed, with at least one open, addable
// section.
async function collapsedCategorySearch(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await submitSearch(page);
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
}

// The category search with the card of 90592008, the first course, opened, so its
// section 901, which is open, can be added from its row.
async function categorySearch(page: Page): Promise<void> {
  await collapsedCategorySearch(page);
  await expandCourse(page, '90592008');
}

interface GridScroll {
  scrollWidth: number;
  clientWidth: number;
  gridWidth: number;
}

// The edit grid renders inside the planner scroller, its parent, so the scroller's widths
// say whether the grid fits the column or scrolls.
async function gridScroll(page: Page): Promise<GridScroll> {
  return page.getByRole('group', { name: GRID_NAME }).evaluate((grid) => {
    const scroller = grid.parentElement;
    return {
      scrollWidth: scroller?.scrollWidth ?? 0,
      clientWidth: scroller?.clientWidth ?? 0,
      gridWidth: grid.getBoundingClientRect().width,
    };
  });
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
]) {
  test.describe(`at ${String(viewport.width)}x${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('shows the working day plan with no horizontal scroll', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      // The real owner 32 capture meets only on Friday, 08:00 to 16:00, inside the
      // 08:00 to 18:00 working day.
      await categorySearch(page);
      await page
        .getByRole('button', { name: /^เพิ่ม/ })
        .first()
        .click();
      await expect(page.locator(GRID_BLOCK).first()).toBeVisible();

      const grid = page.getByRole('group', { name: GRID_NAME });
      await expect(grid.getByText('08:00', { exact: true })).toHaveCount(1);
      await expect(grid.getByText('17:00', { exact: true })).toHaveCount(1);
      await expect(grid.getByText('07:00', { exact: true })).toHaveCount(0);
      await expect(grid.getByText('18:00', { exact: true })).toHaveCount(0);
      await expect(grid.getByLabel('วันเสาร์')).toHaveCount(0);
      await expect(grid.getByLabel('วันอาทิตย์')).toHaveCount(0);

      const scroll = await gridScroll(page);
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
    });
  });
}

test.describe('at 1024x768', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('scrolls a broad result at a readable quarter instead of shrinking it', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    // The real capture with exam windows meets until 20:00 and on both weekend days, so
    // the window widens to 08:00 to 20:00, 48 quarters, past the docked grid column.
    await page.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
    await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000700');
    await submitSearch(page);
    await expect(page.getByText('01006020').first()).toBeVisible({
      timeout: 15_000,
    });

    const grid = page.getByRole('group', { name: GRID_NAME });
    await expect(grid.getByText('19:00', { exact: true })).toHaveCount(1);
    await expect(grid.getByLabel('วันเสาร์')).toHaveCount(1);
    await expect(grid.getByLabel('วันอาทิตย์')).toHaveCount(1);

    const scroll = await gridScroll(page);
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    // 40 px of day labels plus 14 px for each of the 48 quarters.
    expect(scroll.gridWidth).toBeGreaterThanOrEqual(40 + 14 * 48);

    // Only the trailing side hides content at the start, so only it fades.
    const fade = (side: string) => page.locator(`[data-edge-fade="${side}"]`);
    await expect(fade('right')).toHaveCount(1);
    await expect(fade('left')).toHaveCount(0);

    // Scrolled to the end, the day column stays pinned to the scroller's left edge and the
    // fade moves to the leading side.
    const edge = await grid.evaluate((node) => {
      const scroller = node.parentElement;
      scroller?.scrollTo({ left: scroller.scrollWidth });
      return scroller?.getBoundingClientRect().left ?? 0;
    });
    await expect(fade('left')).toHaveCount(1);
    await expect(fade('right')).toHaveCount(0);
    const monday = await grid.getByLabel('วันจันทร์').boundingBox();
    expect(Math.abs((monday?.x ?? -1) - edge)).toBeLessThanOrEqual(1);
    await expect(grid.getByLabel('วันจันทร์')).toBeVisible();
  });
});

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

  // The commit outline marks the planner drop zone from drag activation, while the
  // pointer is still over the catalog, and turns solid once the pointer reaches it.
  const outline = page.locator('[data-commit-zone]');
  await expect(outline).toHaveAttribute('data-commit-zone', 'latent');
  await page.mouse.move(pointerX, pointerY, { steps: 15 });
  await expect(outline).toHaveAttribute('data-commit-zone', 'over');

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
  await expect(outline).toHaveCount(0);
});

test('cancels a block drag silently when the block goes back in place', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page);
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  const placed = page.locator(GRID_BLOCK).first();
  await expect(placed).toBeVisible();
  const from = await placed.boundingBox();
  if (from === null) {
    throw new Error('missing placed block');
  }

  // Arm the block drag with a short move that stays over the block, so the pointer is
  // over its lifted origin, then release there.
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y, { steps: 4 });
  await expect(page.locator('[data-lifted-origin]').first()).toBeVisible();
  await page.mouse.move(x + 2, y, { steps: 2 });
  await page.mouse.up();

  await expect(page.locator('[data-lifted-origin]')).toHaveCount(0);
  await expect(page.locator(GRID_BLOCK)).toHaveCount(1);
  await expect(
    page.getByText('วางบนช่องที่ไฮไลต์หรือพื้นที่นำออก'),
  ).toHaveCount(0);
});

test.describe('on the medium sheet tier', () => {
  // A short window, so the opened course list scrolls inside the sheet.
  test.use({ viewport: { width: 768, height: 640 } });

  test('yields the sheet during a section drag and returns it at the same offset', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    // Reduced motion makes the expand reveal scroll instant, so it cannot land after the
    // offset this test sets, and the sheet slide settles at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: /^รายวิชา/ }).click();
    await categorySearch(page);

    const sheet = page.locator('#kcp-catalog-column');
    const list = sheet.locator('[data-catalog-scroller]');
    await list.evaluate((node) => {
      node.scrollTop = 40;
    });
    const offset = await list.evaluate((node) => node.scrollTop);
    expect(offset).toBeGreaterThan(0);

    const handle = page.locator('[data-drag-surface="section"]').first();
    const from = await handle.boundingBox();
    const grid = await page
      .getByRole('group', { name: GRID_NAME })
      .boundingBox();
    if (from === null || grid === null) {
      throw new Error('missing drag source or grid');
    }
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });

    // The sheet slides to its peek and the scrim lets the grid through.
    await expect(sheet).toHaveAttribute('data-yielded', 'true');
    await expect
      .poll(async () => (await sheet.boundingBox())?.x ?? 0)
      .toBeLessThan(-300);
    await page.mouse.move(grid.x + grid.width * 0.7, grid.y + grid.height / 2, {
      steps: 15,
    });
    await expect(page.locator('[data-commit-zone]')).toHaveAttribute(
      'data-commit-zone',
      'over',
    );
    expect(await list.evaluate((node) => node.scrollTop)).toBe(offset);

    // Release over the peek, outside every target, so nothing is added and the list
    // keeps its content; the sheet returns where the student left it.
    await page.mouse.move(8, grid.y + grid.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(sheet).not.toHaveAttribute('data-yielded');
    await expect.poll(async () => (await sheet.boundingBox())?.x).toBe(0);
    await expect(page.locator(GRID_BLOCK)).toHaveCount(0);
    expect(await list.evaluate((node) => node.scrollTop)).toBe(offset);
  });
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
  await submitSearch(page);
  await expect(page.getByText('01006029').first()).toBeVisible({
    timeout: 15_000,
  });

  await expandCourse(page, '01006029');
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

  // The block itself is the button that opens the popover on a click; the overlay is
  // also a dialog, so the popover is identified by the floating element marker.
  await block.click();
  const popover = page.locator('[data-floating-ui-focusable]');
  await expect(popover).toBeVisible();

  // Removing through the popover clears the block, the same path as the block's own
  // remove control, and closes the popover.
  await popover.getByRole('button', { name: 'นำออกจากตาราง' }).click();
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
  await expect(page.getByRole('button', { name: /^นำออก/ })).toHaveCount(0);
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

test.describe('course hover preview at 1366x768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  const PREVIEW = '[data-preview]';

  function courseHeader(page: Page, subjectId: string) {
    return page
      .getByRole('article')
      .filter({ hasText: subjectId })
      .first()
      .locator('header');
  }

  test('previews a collapsed course and drags it onto a fit slot', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await collapsedCategorySearch(page);
    const header = courseHeader(page, '90592008');
    const toggle = header.locator('[data-course-toggle]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const box = await header.boundingBox();
    if (box === null) {
      throw new Error('missing course header');
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Entering alone does not arm the preview; a small deliberate move and a rest do.
    await page.mouse.move(x, y);
    await page.waitForTimeout(300);
    await expect(page.locator(PREVIEW)).toHaveCount(0);
    await page.mouse.move(x + 6, y, { steps: 2 });
    await expect(page.locator('[data-preview="fit"]').first()).toBeVisible();

    // A header drag replaces the preview with the real candidates and commits on a fit
    // slot without opening the card.
    await page.mouse.down();
    await page.mouse.move(x + 26, y + 20, { steps: 5 });
    const slot = page.locator('[data-candidate="valid"]').first();
    await slot.waitFor();
    await expect(page.locator(PREVIEW)).toHaveCount(0);
    const to = await slot.boundingBox();
    if (to === null) {
      throw new Error('missing candidate slot');
    }
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('never previews while the wheel scrolls the list', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    // The dense catalog holds enough collapsed cards for the list to scroll; the
    // category result fits the column.
    await page.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
    await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000500');
    await submitSearch(page);
    await expect(
      page.getByText(denseSubjectId(0), { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await waitForResultsInput(page);
    const box = await courseHeader(page, denseSubjectId(0)).boundingBox();
    if (box === null) {
      throw new Error('missing course header');
    }

    // A still pointer over the list while the wheel moves the cards under it.
    await page.mouse.move(box.x + box.width / 2, box.y + 4);
    for (let step = 0; step < 8; step += 1) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(60);
      await expect(page.locator(PREVIEW)).toHaveCount(0);
    }
    await page.waitForTimeout(400);
    await expect(page.locator(PREVIEW)).toHaveCount(0);
    // The list really moved under the pointer, so the check above is not vacuous.
    const scrolled = await page
      .locator('[data-catalog-scroller]')
      .evaluate((scroller) => scroller.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
  });
});
