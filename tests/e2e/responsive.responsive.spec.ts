import {
  test,
  expect,
  catalogAtRest,
  expandCourse,
  gotoSelector,
  openPlanner,
  pickOption,
  waitForResultsInput,
  waitForTermSettled,
  submitSearch,
} from './support/fixtures';
import { axeViolations } from './support/axe';
import { denseSubjectId } from './support/denseCatalog';
import { expectLauncherInSafeArea } from './support/launcher';
import { allowEntryToast } from './support/onboarding';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import { bottomNav, isPhone } from './support/tiers';
import {
  LONG_PRESS_MS,
  longPress,
  swipe,
  touchDown,
  touchDrag,
  type Point,
} from './support/touch';
import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Plan } from '../../src/lib/domain/plan';

// A responsive smoke for the phone and tablet projects. It asserts what holds at both
// sizes: the host lays out at the device width, the planner opens and closes with focus
// returned to the launcher, the header keeps close and preview in view and working at
// the device width and at 320 px, the touch helper delivers real touch events, the edit
// grid keeps its derived minimum width, a tapped block opens its details as a bottom
// sheet, the controls a finger reaches are 44 px targets, since both projects are
// coarse pointers, the feedback strip's chips stay tappable over the open catalog, and
// a control keyboard focus reaches is never covered by the sticky submit, the strip, or
// the nav.
// The tablet holds the catalog in a sheet that is modal over the grid and closes alone
// on Escape. The phone, below 640 px, shows one pane at a time behind a bottom nav, so
// the catalog and the timetable each take the whole body in turn, its timetable reads
// one day at a time, stepped by the day chips or a swipe, and during a block drag the
// nav turns into the remove bar. There the open search form fills the catalog pane over
// a pinned submit, and the plan menu and the display options open as bottom sheets.
// The entry toast beside the launcher fits inside the viewport above the launcher.

const LAUNCHER = 'เปิด Course Planner for KMITL';
// A grid block carries a data-teach-table-id; the catalog rows do not.
const GRID_BLOCK = '[data-teach-table-id]';
const OVERLAY = 'ตัววางแผนตารางเรียน สจล.';
// The reserved subject id the mock server answers with the synthetic dense catalog,
// hundreds of collapsed one section courses, so the list is long enough to scroll.
const DENSE_SUBJECT_ID = '90000500';

/**
 * Bring the catalog into view, the catalog pane on the phone and the sheet on the
 * tablet, and return the container that holds the search and the results.
 */
async function openCatalog(page: Page): Promise<Locator> {
  if (isPhone(page)) {
    await bottomNav(page)
      .getByRole('button', { name: /^รายวิชา/ })
      .tap();
    return page.locator('#kcp-catalog-column');
  }
  await page.getByRole('button', { name: /^รายวิชา/ }).click();
  return page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
}

/** Assert the control sits inside the viewport and wholly above the bottom nav. */
async function expectAboveNav(page: Page, control: Locator): Promise<void> {
  await expect(control).toBeInViewport({ ratio: 1 });
  const box = await control.boundingBox();
  const nav = await bottomNav(page).boundingBox();
  expect(box).not.toBeNull();
  expect(nav).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(nav?.y ?? 0);
}

/** Assert a bottom sheet named by its heading is open and meets the viewport bottom. */
async function expectBottomSheet(page: Page, name: string): Promise<Locator> {
  const sheet = page.getByRole('dialog', { name });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('heading', { name })).toBeFocused();
  // The sheet slides up as it enters, so read its edge once the slide settles.
  const height = page.viewportSize()?.height ?? 0;
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return Math.round((box?.y ?? 0) + (box?.height ?? 0));
    })
    .toBe(height);
  return sheet;
}

/** The control that brings the timetable back from the catalog. */
function timetableControl(page: Page): Locator {
  return isPhone(page)
    ? bottomNav(page).getByRole('button', { name: 'ตารางเรียน' })
    : page
        .locator('#kcp-catalog-column')
        .getByRole('button', { name: 'ปิดรายการรายวิชา' });
}

/**
 * Show the given day on the phone, whose timetable reads one day at a time, so a
 * block on that day is in the grid. The wider tiers show the whole week already.
 */
async function showDay(page: Page, dayName: string): Promise<void> {
  if (!isPhone(page)) return;
  await page
    .getByRole('radiogroup', { name: 'วันที่แสดง' })
    .getByRole('radio', { name: new RegExp(`^${dayName}`) })
    .tap();
}

/** Search the owner 32 category from the catalog the page has open. */
async function categorySearch(page: Page, catalog: Locator): Promise<void> {
  await catalog.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await submitSearch(catalog);
  await expect(catalog.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
}

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

test('the launcher pill stays inside the safe area, with no ring after a first open', async ({
  context,
}) => {
  const page = await gotoSelector(context);
  await expectLauncherInSafeArea(page);
  // The settled first run has opened the panel before, so the ring stays off.
  await expect(page.getByRole('button', { name: LAUNCHER })).not.toHaveClass(
    /kcp-launcher-ring/,
  );
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
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'phone',
    'the phone timetable is the day view, which has no week minimum',
  );
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
  // tablet; a narrower one scrolls rather than shrinking the quarters, until under 640 px
  // the day view takes over.
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
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'phone',
    'the phone shows the catalog as a pane, not a sheet',
  );
  const page = await openPlanner(context);
  const overlay = page.getByRole('dialog', { name: OVERLAY });
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
  await submitSearch(sheet);
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

  // Below the docked tiers the catalog is a sheet on the tablet and a pane on the phone.
  await categorySearch(page, await openCatalog(page));
  // Course cards start collapsed, so the first card opens before its add button exists.
  await expandCourse(page, '90592008');
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .tap();
  await timetableControl(page).tap();

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

test('an add made over the covered timetable is confirmed once by a toast that leads to it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await categorySearch(page, await openCatalog(page));
  // The settled search is spoken by the status announcer beside the catalog.
  await expect(
    page.getByRole('status').filter({ hasText: 'พบ 3 รายวิชา 4 กลุ่มเรียน' }),
  ).toHaveCount(1);

  await expandCourse(page, '90592008');
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .tap();

  // The sheet or the catalog pane covers the timetable, so the add is confirmed by the
  // toast alone and the catalog stays in view for the next pick.
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
  // Focus lands on the control that returns to the catalog: the header toggle on the
  // tablet, the timetable nav item on the phone.
  await expect(
    isPhone(page)
      ? bottomNav(page).getByRole('button', { name: 'ตารางเรียน' })
      : page.getByRole('button', { name: /^รายวิชา/ }),
  ).toBeFocused();
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
});

// The reserved id 90000010 serves Exam Course A and Exam Course B, whose section 901
// clashes with A's midterm while section 902 fits. With the catalog open, the sheet on
// the tablet and the catalog pane on the phone, the blocked add of B 901 floats the
// strip over it, above the scrim, the add toast A left, and the bottom nav, so its
// alternative chip takes focus and a finger.
test('the strip chips stay tappable over the open catalog', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const catalog = await openCatalog(page);
  await catalog.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
  await catalog.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000010');
  await submitSearch(catalog);
  await expect(catalog.getByText('90000011').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);

  await addCourse(page, '90000010');
  await expect(page.getByText(/^เพิ่ม 90000010 กลุ่มเรียน/)).toBeVisible();
  await addCourse(page, '90000011');

  const chip = page.getByRole('button', {
    name: 'กลุ่มเรียน 902',
    exact: true,
  });
  await expect(chip).toBeFocused();
  await expect(chip).toBeInViewport({ ratio: 1 });
  // The chip is the element a tap at its centre lands on: no scrim, sheet, toast, or
  // nav covers it.
  expect(
    await chip.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const root = node.getRootNode();
      if (!(root instanceof ShadowRoot)) return false;
      const hit = root.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return hit !== null && node.contains(hit);
    }),
  ).toBe(true);

  await chip.tap();
  // The catalog stays open for the next pick.
  await expect(catalog).toBeVisible();
  // Section 902 meets on Thursday and 901 on Wednesday, so the phone shows Thursday.
  if (isPhone(page)) await timetableControl(page).tap();
  await showDay(page, 'วันพฤหัสบดี');
  await expect(page.locator(block('910003'))).toHaveCount(1);
  await expect(page.locator(block('910002'))).toHaveCount(0);
});

// In the synthetic catalog under 90000000, Course B 90000002 overlaps Course A and has
// no other section, so its blocked add offers the reveal action alone. Pressed with the
// catalog put away, the action brings it back, the sheet on the tablet and the catalog
// pane on the phone, and hands focus to the course's card.
test('the reveal action opens the catalog on the blocked course', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await openCatalog(page);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await addCourse(page, '90000002');
  const reveal = page.getByRole('button', { name: 'แสดงในรายการ' });
  await expect(reveal).toBeFocused();

  const column = page.locator('#kcp-catalog-column');
  await timetableControl(page).tap();
  await expect(column).toHaveAttribute('aria-hidden', 'true');
  await expect(reveal).toBeVisible();
  await reveal.tap();
  await expect(column).not.toHaveAttribute('aria-hidden', 'true');
  const card = column.locator('#kcp-course-toggle-90000002');
  await expect(card).toBeFocused();
  await expect(card).toBeInViewport();
  await expect(reveal).toHaveCount(0);
});

/**
 * Assert the focused control lies wholly in the viewport and is what a press lands on at
 * its centre and near each corner, so no sticky submit, strip, toast, or nav covers any
 * part of it (WCAG 2.4.11). The corner points sit inside the corner radius.
 */
async function expectUnobscured(control: Locator, name: string): Promise<void> {
  await expect(control, name).toBeFocused();
  await expect(control, name).toBeInViewport({ ratio: 1 });
  const covered = await control.evaluate((node) => {
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot)) return ['outside the panel'];
    const box = node.getBoundingClientRect();
    const inset = Math.min(8, box.width / 4, box.height / 4);
    const points: [string, number, number][] = [
      ['centre', box.left + box.width / 2, box.top + box.height / 2],
      ['top left', box.left + inset, box.top + inset],
      ['top right', box.right - inset, box.top + inset],
      ['bottom left', box.left + inset, box.bottom - inset],
      ['bottom right', box.right - inset, box.bottom - inset],
    ];
    // Each covered point names what lies on top, by its closest labelled ancestor.
    return points.flatMap(([point, x, y]) => {
      const hit = root.elementFromPoint(x, y);
      if (hit !== null && node.contains(hit)) return [];
      const cover = hit?.closest('[id], [role], [aria-label]') ?? hit;
      const label =
        cover === null
          ? 'nothing'
          : `${cover.tagName.toLowerCase()} ${cover.id} ${cover.getAttribute('role') ?? ''} ${cover.getAttribute('aria-label') ?? ''}`;
      return [`${point} under ${label.trim()}`];
    });
  });
  expect(covered, `${name} covered at`).toEqual([]);
}

/** Whether the locator holds the focused element of the panel's shadow root. */
async function isFocused(control: Locator): Promise<boolean> {
  return control.evaluate((node) => {
    const root = node.getRootNode();
    return root instanceof ShadowRoot && root.activeElement === node;
  });
}

test('keeps keyboard focus clear of the sticky submit, the strip, and the nav', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const catalog = await openCatalog(page);

  // Tab from the first control of the search form to its last: each one focus reaches
  // sits in view, clear of the pinned submit on the phone and of the nav.
  const form = page.locator('#kcp-search-form');
  await form.getByRole('combobox', { name: 'ปีการศึกษา' }).focus();
  const visited: string[] = [];
  while ((await form.locator(':focus').count()) > 0 && visited.length < 30) {
    const focused = form.locator(':focus');
    const name = await focused.evaluate(
      (node) => node.getAttribute('aria-label') ?? node.textContent,
    );
    visited.push(name);
    await expectUnobscured(focused, `form control ${name}`);
    await page.keyboard.press('Tab');
  }
  expect(visited).toContain('ค้นหา');

  // A blocked add floats the strip over the foot of the catalog, and the pointer resting
  // on it holds it there. Tab to the last add button of the open list: the list scrolls
  // it clear of the strip and the nav rather than under them.
  await syntheticSearch(page);
  await catalog.getByRole('button', { name: 'ขยายทั้งหมด' }).click();
  await catalogAtRest(page);
  await addCourse(page, '90000001');
  await addCourse(page, '90000002');
  const reveal = page.getByRole('button', { name: 'แสดงในรายการ' });
  await expect(reveal).toBeFocused();
  await reveal.hover();

  const lastCard = catalog.locator('[data-course-card]').last();
  const lastAdd = lastCard.getByRole('button', { name: /^เพิ่ม / }).last();
  await lastCard.locator('[data-course-toggle]').focus();
  for (let step = 0; step < 12 && !(await isFocused(lastAdd)); step += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(reveal).toBeVisible();
  await expectUnobscured(lastAdd, 'last add button');
});

/** The control that shows the summary: the nav item on the phone, the tab on the tablet. */
function summaryControl(page: Page, name: string): Locator {
  return isPhone(page)
    ? bottomNav(page).getByRole('button', { name, exact: true })
    : page.getByRole('tab', { name, exact: true });
}

// An exam clash cannot be added, so the clashing plan arrives through JSON import: the
// plan holding Exam Course A is exported, an entry of another subject is written into it
// on another day with A's midterm window, and the file is imported. Its section, 903, is
// not in the live result, so revalidation keeps its snapshot as missing and the clash
// stays. The summary item, the nav item on the phone and the tab on the tablet, then
// carries the clash in its name, and the exam schedule names the other subject on A's row.
test('the summary marks an imported exam clash and lists it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  const catalog = await openCatalog(page);
  await catalog.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
  await catalog.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000010');
  await submitSearch(catalog);
  await expect(catalog.getByText('90000011').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
  await addCourse(page, '90000010');
  await expect(page.getByText(/^เพิ่ม 90000010 กลุ่มเรียน/)).toBeVisible();
  await timetableControl(page).tap();
  await expect(summaryControl(page, 'สรุป')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'เลือกตาราง' }).click();
  await page.getByRole('button', { name: 'ส่งออก JSON' }).click();
  const exported = readFileSync(await (await downloadPromise).path(), 'utf8');
  // The export is the plan the app validated through its schema before writing it, so
  // the test reads it as that shape to write the clashing copy into it.
  const plan = JSON.parse(exported) as Plan;
  const [first] = plan.entries;
  if (first === undefined) throw new Error('expected the exported entry');
  const ids = { teachTableId: '910099', subjectId: '90000011', section: '903' };
  plan.entries.push({
    ...first,
    ...ids,
    snapshot: {
      ...first.snapshot,
      ...ids,
      pairedSection: null,
      // A sits on Tuesday, so the copy moves to Thursday and never clashes in time.
      meetings: first.snapshot.meetings.map((meeting) => ({
        ...meeting,
        day: 4,
      })),
      subjectMeta: {
        ...first.snapshot.subjectMeta,
        subjectId: '90000011',
        nameTh: 'Exam Course C',
        nameEn: 'Exam Course C',
      },
    },
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'clash.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  });

  const summary = summaryControl(page, 'สรุป มีวิชาที่สอบชนกัน');
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await summary.tap();
  await expect(
    page.getByRole('heading', { name: 'ตารางสอบ', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('สอบชนกับ 90000011 Exam Course C กลุ่มเรียน 903'),
  ).toBeVisible();
  await expect(page.getByText(/^สอบชนกับ 90000010 /)).toBeVisible();
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
  const dialog = page.getByRole('dialog', { name: OVERLAY });
  const header = dialog.locator('header');

  // The header: the plan switcher height, the catalog toggle on the tablet, both mode
  // segments, the overflow menu and close. The phone reaches the catalog from the nav.
  const switcher = header.getByRole('button', { name: 'เลือกตาราง' });
  expect((await switcher.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
    TOUCH_TARGET,
  );
  const controls: [Locator, string][] = [
    [header.getByRole('button', { name: 'แก้ไข' }), 'edit segment'],
    [header.getByRole('button', { name: 'ดูตัวอย่าง' }), 'preview segment'],
    [header.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }), 'overflow'],
    [header.getByRole('button', { name: 'ปิด', exact: true }), 'close'],
  ];
  if (!isPhone(page)) {
    controls.unshift([
      header.getByRole('button', { name: /^รายวิชา/ }),
      'catalog toggle',
    ]);
  }
  for (const [control, name] of controls) {
    await expectTouchTarget(control, name);
  }

  // The search form in the catalog: a tab and the submit.
  const sheet = await openCatalog(page);
  const tab = sheet.getByRole('tab', { name: 'หมวดวิชา' });
  await expectTouchTarget(tab, 'search tab');
  await tab.click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  const submit = sheet.getByRole('button', { name: 'ค้นหา', exact: true });
  await expectTouchTarget(submit, 'search submit');
  await waitForTermSettled(sheet);
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
  const back = timetableControl(page);
  await expectTouchTarget(back, 'timetable control');
  await back.tap();
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

/** The centre of a laid out element, as a point a finger can press. */
async function centre(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('expected a laid out element');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Assert the overlay lays out inside the viewport width, with nothing scrolling it sideways. */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page
    .getByRole('dialog', { name: OVERLAY })
    .evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      right: node.getBoundingClientRect().right,
    }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  expect(overflow.right).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

test.describe('the phone layout', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'phone',
      'the panes and the bottom nav show below 640 px only',
    );
  });

  test('shows one pane at a time behind a bottom nav with no horizontal overflow', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    const nav = bottomNav(page);
    const catalog = nav.getByRole('button', { name: /^รายวิชา/ });
    const timetable = nav.getByRole('button', { name: 'ตารางเรียน' });
    const selected = nav.getByRole('button', { name: /^ที่เลือก/ });
    const summary = nav.getByRole('button', { name: /^สรุป/ });
    for (const item of [catalog, timetable, selected, summary]) {
      expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        56,
      );
    }
    // An empty plan opens on the catalog pane, and the header holds no catalog toggle.
    await expect(catalog).toHaveAttribute('aria-current', 'page');
    await expect(
      page.locator('header').getByRole('button', { name: /^รายวิชา/ }),
    ).toHaveCount(0);
    const column = page.locator('#kcp-catalog-column');
    // The phone timetable is the day view, which opens on Monday for an empty plan.
    const grid = page.getByRole('group', { name: 'ตารางเรียนวันจันทร์' });
    await expect(column.getByRole('tab', { name: 'หมวดวิชา' })).toBeVisible();
    await expect(grid).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await timetable.tap();
    await expect(timetable).toBeFocused();
    await expect(grid).toBeVisible();
    await expect(column).toHaveAttribute('aria-hidden', 'true');
    await expectNoHorizontalOverflow(page);

    await selected.tap();
    await expect(
      page.getByRole('heading', { name: 'ยังไม่ได้เลือกรายวิชา' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 320, height: 640 });
    await expectNoHorizontalOverflow(page);

    // Preview is the poster, with no nav.
    await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();
    await expect(nav).toHaveCount(0);
  });

  test('keeps the catalog scroll across a pane switch and starts no drag from a row', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    const column = page.locator('#kcp-catalog-column');
    await column.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
    await column
      .getByRole('textbox', { name: 'รหัสวิชา' })
      .fill(DENSE_SUBJECT_ID);
    await submitSearch(column);
    await expect(
      column.getByText(denseSubjectId(0), { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await waitForResultsInput(page);

    const scroller = page.locator('[data-catalog-scroller]');
    await scroller.evaluate((node) => {
      node.scrollTop = 900;
    });
    await catalogAtRest(page);
    const offset = await scroller.evaluate((node) => node.scrollTop);
    expect(offset).toBeGreaterThan(0);

    const nav = bottomNav(page);
    await nav.getByRole('button', { name: 'ตารางเรียน' }).tap();
    await expect(column).toHaveAttribute('aria-hidden', 'true');
    await nav.getByRole('button', { name: /^รายวิชา/ }).tap();
    await expect(column).not.toHaveAttribute('aria-hidden', 'true');
    expect(await scroller.evaluate((node) => node.scrollTop)).toBe(offset);

    // The timetable is in another pane, so a long press on a row starts no drag. The
    // hidden drop zone sits under the row, so a drag that started would commit on lift:
    // the plan staying empty is what proves no drag ran, since the drag card is gone
    // after the lift either way.
    const toggle = column.locator('[data-course-toggle]').first();
    await toggle.tap();
    const row = column.locator('[data-drag-surface="section"]').first();
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    if (box === null) throw new Error('expected a laid out row');
    const centre: Point = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    await longPress(page, centre);
    await expect(page.locator('[data-drag-card]')).toHaveCount(0);
    await expect(page.locator(GRID_BLOCK)).toHaveCount(0);
    await expect(
      nav.getByRole('button', { name: 'ที่เลือก', exact: true }),
    ).toBeVisible();
  });

  test('fills the pane with the search form and adds from the results by button', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    const column = page.locator('#kcp-catalog-column');
    const results = page.locator('[data-catalog-scroller]');
    const submit = column.getByRole('button', { name: 'ค้นหา', exact: true });
    // Before any search the form fills the pane, its submit pinned above the nav, and
    // the idle results wait hidden under it.
    await expect(results).toBeHidden();
    await expectAboveNav(page, submit);
    await expect(column.getByRole('button', { name: 'ยกเลิก' })).toHaveCount(0);

    await categorySearch(page, column);
    const bar = column.getByRole('region', { name: 'การค้นหาปัจจุบัน' });
    await expect(bar).toBeFocused();
    await expect(results).toBeVisible();
    await expect(page.locator('#kcp-search-form')).toHaveAttribute(
      'data-open',
      'false',
    );

    // Reopened, the form takes the pane again and its cancel folds it back under the
    // bar, with the results where they were.
    const disclosure = bar.getByRole('button', { name: 'แก้ไขการค้นหา' });
    await disclosure.tap();
    await expect(results).toBeHidden();
    const cancel = column.getByRole('button', { name: 'ยกเลิก' });
    await expectAboveNav(page, cancel);
    await expectAboveNav(page, submit);
    await cancel.tap();
    await expect(disclosure).toBeFocused();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(results).toBeVisible();

    // The rows carry no grip on the phone, only the add button, and the add is
    // confirmed by the toast that leads to the timetable.
    await expandCourse(page, '90592008');
    await expect(
      column.locator('button[aria-label^="ลากเพื่อเพิ่มลงตาราง"]'),
    ).toHaveCount(0);
    await column
      .getByRole('button', { name: /^เพิ่ม 90592008/ })
      .first()
      .tap();
    await expect(
      page.getByText(/^เพิ่ม 90592008 กลุ่มเรียน \d+ แล้ว$/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'ดูตาราง' }).tap();
    await expect(
      bottomNav(page).getByRole('button', { name: 'ตารางเรียน' }),
    ).toBeFocused();
    await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
  });

  test('opens the plan menu and the display options as bottom sheets', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    const switcher = page
      .locator('header')
      .getByRole('button', { name: 'เลือกตาราง' });
    await switcher.tap();
    const menu = await expectBottomSheet(page, 'เลือกตาราง');
    await expectTouchTarget(
      menu.getByRole('button', { name: 'สร้างตาราง' }),
      'plan create',
    );
    await menu.getByRole('button', { name: 'ปิด', exact: true }).tap();
    await expect(menu).toHaveCount(0);
    await expect(switcher).toBeFocused();

    await page.getByRole('button', { name: 'ดูตัวอย่าง' }).tap();
    const trigger = page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' });
    await trigger.tap();
    const options = await expectBottomSheet(page, 'ตัวเลือกการแสดงผล');
    const showRoom = options.getByRole('switch', { name: 'แสดงห้อง' });
    await expect(showRoom).toBeChecked();
    await showRoom.tap();
    await expect(showRoom).not.toBeChecked();
    // A tap inside the sheet keeps it open; Escape closes it alone.
    await expect(options).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('dialog', { name: OVERLAY })).toBeVisible();
  });

  test('carries the result and selected counts in the nav item names', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await categorySearch(page, page.locator('#kcp-catalog-column'));
    const nav = bottomNav(page);
    await expect(
      nav.getByRole('button', { name: 'รายวิชา 3', exact: true }),
    ).toHaveText(/3/);

    await expandCourse(page, '90592008');
    await page
      .getByRole('button', { name: /^เพิ่ม/ })
      .first()
      .tap();
    await expect(
      nav.getByRole('button', { name: 'ที่เลือก 1', exact: true }),
    ).toBeVisible();
    // The add never switches panes.
    await expect(
      nav.getByRole('button', { name: 'รายวิชา 3', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('turns the nav into the remove bar for a long pressed block, with undo', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await syntheticSearch(page);
    // Course X section 901 (id 900006) is paired with section 902 (id 900007).
    await addCourse(page, '90000006');
    const nav = bottomNav(page);
    await nav.getByRole('button', { name: 'ตารางเรียน' }).tap();
    await expect(page.locator(block('900006'))).toBeVisible();
    const navBox = await nav.boundingBox();

    const from = await centre(page.locator(block('900006')));
    const finger = await touchDown(page, from);
    try {
      // A long press is defined by elapsed time, so this wait is the gesture itself.
      await page.waitForTimeout(LONG_PRESS_MS);
      await finger.moveTo({ x: from.x + 24, y: from.y + 24 }, 6);
      // The bar takes the nav's place: the items give way and the nav keeps its box,
      // so the timetable above it does not resize mid drag.
      const bar = nav.locator('[data-remove-zone="bar"]');
      await expect(bar).toBeVisible();
      await expect(page.locator('[data-remove-zone]')).toHaveCount(1);
      await expect(nav.getByRole('button')).toHaveCount(0);
      expect(await nav.boundingBox()).toEqual(navBox);
      await finger.moveTo(await centre(bar), 12);
    } finally {
      await finger.lift();
    }

    await expect(page.locator(block('900006'))).toHaveCount(0);
    await expect(page.locator(block('900007'))).toHaveCount(0);
    await expect(nav.locator('[data-remove-zone]')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'ตารางเรียน' })).toBeVisible();
    await page.getByRole('button', { name: 'เลิกทำ' }).tap();
    await expect(page.locator(block('900006'))).toBeVisible();
    // The pair's other half meets on Tuesday, a day the phone shows on its own.
    await showDay(page, 'วันอังคาร');
    await expect(page.locator(block('900007'))).toBeVisible();
  });

  test('reads the timetable one day at a time and steps the day by a swipe', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await categorySearch(page, page.locator('#kcp-catalog-column'));
    await expandCourse(page, '90592008');
    await page
      .getByRole('button', { name: /^เพิ่ม/ })
      .first()
      .tap();
    await timetableControl(page).tap();

    // The one class falls on Friday, so the day view opens there, its chip marked.
    const days = page.getByRole('radiogroup', { name: 'วันที่แสดง' });
    const friday = days.getByRole('radio', { name: 'วันศุกร์ มีเรียน' });
    await expect(friday).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByRole('group', { name: 'ตารางเรียนวันศุกร์' }),
    ).toBeVisible();
    const classBlock = page.locator(GRID_BLOCK).first();
    await expect(classBlock).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // A swipe to the right that starts on the block brings in the day before. It starts
    // no drag, and the free day names itself.
    const box = await classBlock.boundingBox();
    if (box === null) throw new Error('expected a laid out block');
    const from: Point = { x: box.x + 40, y: box.y + box.height / 2 };
    await swipe(page, from, { x: from.x + 200, y: from.y }, 10);
    await expect(
      days.getByRole('radio', { name: 'วันพฤหัสบดี' }),
    ).toHaveAttribute('aria-checked', 'true');
    // The timetable claims the sideways finger, so the browser never reads it as a back
    // navigation away from the host page.
    expect(page.url()).toContain('regis.reg.kmitl.ac.th');
    await expect(page.locator('[data-drag-card]')).toHaveCount(0);
    const freeDay = page.locator('[data-grid-notice="free-day"]');
    await expect(freeDay).toContainText('วันพฤหัสบดี');
    await expect(freeDay).toContainText('วันว่าง');

    // The chip is the path back, and the plan kept its class.
    await friday.tap();
    await expect(page.locator(GRID_BLOCK)).toHaveCount(1);
  });
});

test.describe('the entry toast', () => {
  test.beforeEach(async ({ context }) => {
    await allowEntryToast(context);
  });

  test('sits inside the viewport above the launcher and passes axe', async ({
    context,
  }) => {
    const page = await gotoSelector(context);
    const toast = page.locator('[data-entry-toast]');
    // Past the settle and the 2000 ms delay, with room for a cold page to mount.
    await expect(toast).toBeVisible({ timeout: 10_000 });
    // The emulated devices report no safe area insets, so the viewport is the safe area.
    await expect(toast).toBeInViewport({ ratio: 1 });

    const toastBox = await toast.boundingBox();
    const launcherBox = await page
      .getByRole('button', { name: LAUNCHER })
      .boundingBox();
    if (toastBox === null || launcherBox === null) {
      throw new Error('expected the toast and the launcher to be laid out');
    }
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(launcherBox.y);
    const viewport = page.viewportSize();
    if (viewport === null) throw new Error('The project sets no viewport');
    expect(toastBox.x).toBeGreaterThanOrEqual(16);
    expect(
      viewport.width - (toastBox.x + toastBox.width),
    ).toBeGreaterThanOrEqual(20);

    expect(await axeViolations(page)).toEqual([]);
  });
});
