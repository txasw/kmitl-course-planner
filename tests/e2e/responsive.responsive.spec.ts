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
import type { Page } from '@playwright/test';

// A responsive smoke for the phone and tablet projects. It asserts only what holds
// today at both sizes: the host lays out at the device width, the planner opens and
// closes with focus returned to the launcher, and the touch helper delivers real
// touch events, the edit grid keeps its derived minimum width, and a tapped block opens
// its details as a bottom sheet, since both projects are coarse pointers. The small
// screen layout work adds its own assertions on top.

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
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
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
