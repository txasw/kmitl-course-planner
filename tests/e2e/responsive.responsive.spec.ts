import {
  test,
  expect,
  expandCourse,
  gotoSelector,
  openPlanner,
  pickOption,
  waitForResultsInput,
} from './support/fixtures';
import { LONG_PRESS_MS, longPress, swipe, touchDrag } from './support/touch';
import type { Locator, Page } from '@playwright/test';

// A responsive smoke for the phone and tablet projects. It asserts what holds at both
// sizes: the host lays out at the device width, the planner opens and closes with focus
// returned to the launcher, the header keeps close and preview in view and working at
// the device width and at 320 px, the touch helper delivers real touch events, the edit
// grid keeps its derived minimum width, the catalog sheet is modal over the grid and
// closes alone on Escape, a tapped block opens its details as a bottom sheet, and the
// controls a finger reaches are 44 px targets, since both projects are coarse pointers.
// The small screen layout work adds its own assertions on top.

const LAUNCHER = 'เปิด Course Planner for KMITL';
// A grid block carries a data-teach-table-id; the catalog rows do not.
const GRID_BLOCK = '[data-teach-table-id]';

interface TouchRecord {
  type: string;
  x: number;
  y: number;
  at: number;
}

/**
 * Record every touch event the host document receives, for reading back. With
 * claimMoves the recorder cancels each move the way a touch drag library does, so
 * the browser keeps delivering every move instead of handing the gesture to a
 * scroll.
 */
async function recordTouches(page: Page, claimMoves = false): Promise<void> {
  await page.evaluate((claim) => {
    const log: TouchRecord[] = [];
    (window as unknown as { touchLog: TouchRecord[] }).touchLog = log;
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      document.addEventListener(
        type,
        (event) => {
          if (claim && type === 'touchmove') event.preventDefault();
          const touch = (event as TouchEvent).changedTouches[0];
          log.push({
            type,
            x: touch?.clientX ?? -1,
            y: touch?.clientY ?? -1,
            at: event.timeStamp,
          });
        },
        { passive: false },
      );
    }
  }, claimMoves);
}

async function readTouches(page: Page): Promise<TouchRecord[]> {
  return page.evaluate(
    () => (window as unknown as { touchLog: TouchRecord[] }).touchLog,
  );
}

test('the host lays out at the device width', async ({ context }) => {
  const page = await gotoSelector(context);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(await page.evaluate(() => window.innerWidth)).toBe(viewport?.width);
});

test('the planner opens and closes with focus back on the launcher', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: LAUNCHER })).toBeFocused();
});

/**
 * Assert the header keeps its exit and its preview control inside the viewport and
 * working: the header stays one row, preview switches the mode, and close leaves the
 * overlay. Both clicks go through Playwright's actionability checks, so a control that
 * is off screen or covered by a neighbour fails here.
 */
async function expectHeaderExitsReachable(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  const header = dialog.locator('header');
  const close = dialog.getByRole('button', { name: 'ปิด', exact: true });
  const preview = dialog.getByRole('button', { name: 'ดูตัวอย่าง' });
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  for (const control of [close, preview]) {
    await expect(control).toBeInViewport({ ratio: 1 });
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      viewport?.width ?? 0,
    );
  }
  // One row: 56 px, or 48 px on a short viewport, plus the bottom border.
  const headerBox = await header.boundingBox();
  expect(headerBox?.height ?? 0).toBeLessThanOrEqual(57);

  await preview.click();
  await expect(preview).toHaveAttribute('aria-pressed', 'true');
  await close.click();
  await expect(dialog).toBeHidden();
}

test('close and preview stay in view and work at the device width', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await expectHeaderExitsReachable(page);
});

test('close and preview stay in view and work at 320 px', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await page.setViewportSize({ width: 320, height: 640 });
  await expectHeaderExitsReachable(page);
});

test('the edit grid keeps its derived minimum and fits where the column allows', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const grid = page.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
  await expect(grid).toBeVisible();
  const scroll = await grid.evaluate((node) => {
    const scroller = node.parentElement;
    return {
      scrollWidth: scroller?.scrollWidth ?? 0,
      clientWidth: scroller?.clientWidth ?? 0,
      gridWidth: node.getBoundingClientRect().width,
    };
  });
  // An empty plan shows the 08:00 to 18:00 working day: 40 px of day labels plus 14 px
  // for each of its 40 quarters. A column at least that wide shows it whole, as on the
  // tablet; a narrower one, as on the phone, scrolls rather than shrinking the quarters.
  const minimum = 40 + 14 * 40;
  expect(scroll.gridWidth).toBeGreaterThanOrEqual(minimum);
  if (scroll.clientWidth >= minimum) {
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
  } else {
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
  }
});

test('a long press holds one point for the full press', async ({ context }) => {
  const page = await gotoSelector(context);
  await recordTouches(page);
  await longPress(page, { x: 60, y: 200 });

  const touches = await readTouches(page);
  expect(touches.map((t) => t.type)).toEqual(['touchstart', 'touchend']);
  const [start, end] = touches;
  expect(start).toMatchObject({ x: 60, y: 200 });
  expect((end?.at ?? 0) - (start?.at ?? 0)).toBeGreaterThanOrEqual(
    LONG_PRESS_MS,
  );
});

test('a swipe moves the finger from its start to its end point', async ({
  context,
}) => {
  const page = await gotoSelector(context);
  await recordTouches(page);
  await swipe(page, { x: 200, y: 600 }, { x: 200, y: 300 }, 6);

  // An unclaimed move may be handed to a scroll and throttled, so only the end
  // point is fixed, not the number of moves the page sees.
  const moves = (await readTouches(page)).filter((t) => t.type === 'touchmove');
  expect(moves.length).toBeGreaterThan(0);
  expect(moves.at(-1)).toMatchObject({ x: 200, y: 300 });
});

test('a touch drag holds before the finger moves', async ({ context }) => {
  const page = await gotoSelector(context);
  await recordTouches(page, true);
  await touchDrag(page, { x: 80, y: 300 }, { x: 240, y: 300 }, 4);

  const touches = await readTouches(page);
  expect(touches.map((t) => t.type)).toEqual([
    'touchstart',
    'touchmove',
    'touchmove',
    'touchmove',
    'touchmove',
    'touchend',
  ]);
  const [start, firstMove] = touches;
  expect((firstMove?.at ?? 0) - (start?.at ?? 0)).toBeGreaterThanOrEqual(
    LONG_PRESS_MS,
  );
  expect(touches.at(-2)).toMatchObject({ x: 240, y: 300 });
});

test('the catalog sheet holds its search and results and closes alone on Escape', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const overlay = page.getByRole('dialog', {
    name: 'ตัววางแผนตารางเรียน สจล.',
  });
  const toggle = page.getByRole('button', { name: /^รายวิชา/ });
  await toggle.click();

  // The open sheet takes focus and the grid region under its scrim is inert.
  const sheet = page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
  await expect(sheet).toBeFocused();
  const grid = page.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
  expect(await grid.evaluate((node) => node.closest('[inert]') !== null)).toBe(
    true,
  );

  // The submit sits in the sheet, and its results land in the same open sheet.
  await sheet.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await sheet.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(sheet.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await sheet.evaluate((node) => {
      const root = node.getRootNode();
      return (
        (root instanceof ShadowRoot || root instanceof Document) &&
        node.contains(root.activeElement)
      );
    }),
  ).toBe(true);

  // Escape closes the sheet alone, and focus returns to the header toggle.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(overlay).toBeVisible();
  await expect(toggle).toBeFocused();
  expect(await grid.evaluate((node) => node.closest('[inert]') === null)).toBe(
    true,
  );

  // The next Escape closes the overlay.
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
});

test('a tapped block opens its details as a sheet with the remove action', async ({
  context,
}) => {
  const page = await openPlanner(context);
  // Both projects are touch screens, so the details open as a sheet at either width.
  expect(
    await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches),
  ).toBe(true);

  // Below the docked tiers the catalog is a sheet opened from the header.
  await page.getByRole('button', { name: /^รายวิชา/ }).click();
  await page.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
  // Course cards start collapsed, so the first card opens before its add button exists.
  await waitForResultsInput(page);
  await expandCourse(page, '90592008');
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .tap();
  await page
    .locator('#kcp-catalog-column')
    .getByRole('button', { name: 'ปิดรายการรายวิชา' })
    .tap();

  const block = page.locator(GRID_BLOCK).first();
  await expect(block).toBeVisible();
  const teachTableId = await block.getAttribute('data-teach-table-id');
  await block.tap();

  const sheet = page.getByRole('dialog', { name: /กลุ่มเรียน/ });
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  await expect(sheet.getByRole('heading')).toBeFocused();
  const remove = sheet.getByRole('button', { name: 'นำออกจากตาราง' });
  await expect(remove).toBeVisible();
  // The footer actions are touch targets.
  expect((await remove.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

  await remove.tap();
  await expect(sheet).toHaveCount(0);
  await expect(
    page.locator(`[data-teach-table-id="${teachTableId ?? ''}"]`),
  ).toHaveCount(0);
});

test('an add from the open sheet is confirmed once by a toast that leads to the timetable', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const toggle = page.getByRole('button', { name: /^รายวิชา/ });
  await toggle.click();
  await page.getByRole('tab', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  // The settled search is spoken by the status announcer beside the sheet.
  await expect(
    page.getByRole('status').filter({ hasText: 'พบ 3 รายวิชา 4 กลุ่มเรียน' }),
  ).toHaveCount(1, { timeout: 15_000 });

  await waitForResultsInput(page);
  await expandCourse(page, '90592008');
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .tap();

  // The sheet covers the timetable, so the add is confirmed by the toast alone and the
  // sheet stays open for the next pick.
  const column = page.locator('#kcp-catalog-column');
  await expect(
    page.getByText(/^เพิ่ม 90592008 กลุ่มเรียน \d+ แล้ว$/),
  ).toBeVisible();
  await expect(
    page.locator('[aria-live]').filter({ hasText: '90592008' }),
  ).toHaveCount(1);
  await expect(column).not.toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('button', { name: 'ดูตาราง' }).tap();
  await expect(column).toHaveAttribute('aria-hidden', 'true');
  await expect(toggle).toBeFocused();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

// The coarse pointer target from the --kcp-target-touch token.
const TOUCH_TARGET = 44;

/** Assert a control is visible and at least a touch target in each direction. */
async function expectTouchTarget(
  control: Locator,
  name: string,
): Promise<void> {
  await expect(control, name).toBeVisible();
  const box = await control.boundingBox();
  expect(box, name).not.toBeNull();
  expect(box?.width ?? 0, `${name} width`).toBeGreaterThanOrEqual(TOUCH_TARGET);
  expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(
    TOUCH_TARGET,
  );
}

test('the controls a finger reaches are 44 px targets', async ({ context }) => {
  const page = await openPlanner(context);
  const dialog = page.getByRole('dialog', {
    name: 'ตัววางแผนตารางเรียน สจล.',
  });
  const header = dialog.locator('header');

  // The header: the plan switcher height, the catalog toggle, both mode segments, the
  // overflow menu and close.
  const switcher = header.getByRole('button', { name: 'เลือกตาราง' });
  expect((await switcher.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
    TOUCH_TARGET,
  );
  const toggle = header.getByRole('button', { name: /^รายวิชา/ });
  for (const [control, name] of [
    [toggle, 'catalog toggle'],
    [header.getByRole('button', { name: 'แก้ไข' }), 'edit segment'],
    [header.getByRole('button', { name: 'ดูตัวอย่าง' }), 'preview segment'],
    [header.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }), 'overflow'],
    [header.getByRole('button', { name: 'ปิด', exact: true }), 'close'],
  ] as const) {
    await expectTouchTarget(control, name);
  }

  // The search form in the catalog sheet: a tab and the submit.
  await toggle.click();
  const sheet = page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
  const tab = sheet.getByRole('tab', { name: 'หมวดวิชา' });
  await expectTouchTarget(tab, 'search tab');
  await tab.click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  const submit = sheet.getByRole('button', { name: 'ค้นหา', exact: true });
  await expectTouchTarget(submit, 'search submit');
  await submit.click();
  await expect(sheet.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);

  // The catalog: the summary actions, the filter toggle, the add rail, and the remove
  // control the added card shows.
  await expectTouchTarget(
    sheet.getByRole('button', { name: 'รีเฟรช' }),
    'refresh',
  );
  await expectTouchTarget(
    sheet.getByRole('button', { name: 'ขยายทั้งหมด' }),
    'expand all',
  );
  await expectTouchTarget(
    sheet.getByRole('button', { name: 'ตัวกรอง' }),
    'filter toggle',
  );
  await expandCourse(page, '90592008');
  const add = sheet.getByRole('button', { name: /^เพิ่ม 90592008/ });
  await expectTouchTarget(add, 'add rail');
  await add.tap();
  await expectTouchTarget(
    sheet.getByRole('button', { name: /^นำออก 90592008/ }),
    'catalog remove',
  );

  // The placed block carries no remove control on a coarse pointer; its tap opens the
  // detail sheet, which holds the remove action.
  await page
    .locator('#kcp-catalog-column')
    .getByRole('button', { name: 'ปิดรายการรายวิชา' })
    .tap();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'นำออก', exact: true }),
  ).toHaveCount(0);

  // The plan menu: the row actions show at rest on a touch screen and take a finger.
  await switcher.click();
  const rename = page.getByRole('button', { name: /^เปลี่ยนชื่อ / });
  await expect(rename).toBeVisible();
  const opacity = await rename.evaluate((node) =>
    Number(getComputedStyle(node.parentElement ?? node).opacity),
  );
  expect(opacity).toBe(1);
  await expectTouchTarget(rename, 'plan rename');
  await expectTouchTarget(
    page.getByRole('button', { name: 'สร้างตาราง' }),
    'plan create',
  );
});
