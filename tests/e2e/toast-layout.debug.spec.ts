import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator } from '@playwright/test';
import { test, expect } from './support/fixtures';
import {
  addCourse,
  blockDetail,
  dismissToasts,
  openAt,
  openSweep,
  searchSubjectId,
  showCatalog,
  showTimetable,
  type Sweep,
} from './support/textFitSweep';

// A toast never moves the layout (ADR-0048 amendment of 2026-11-22). It floats over the plan
// above the status row, the phone bottom nav, and the phone sharing toolbar, and nothing makes
// room for it, so the boxes of the status row, the timetable grid, and the export toolbar are
// the same before a toast shows, while it shows, and after it leaves, at 360, 390, 768, and
// 1366 px in Thai and in English. The toast must also cover none of the foot controls it
// floats above. TOAST_SHOT_DIR saves a screenshot before and while each toast shows.

const WIDTHS = [360, 390, 768, 1366] as const;

test.use({ actionTimeout: 10_000 });

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator, name: string): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`${name} is not laid out`);
  return box;
}

/** The boxes of the named elements, read in one pass. */
async function boxes(
  targets: Record<string, Locator>,
): Promise<Record<string, Box>> {
  const read: Record<string, Box> = {};
  for (const [name, locator] of Object.entries(targets)) {
    read[name] = await boxOf(locator, name);
  }
  return read;
}

function intersects(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** The toast on show: the one child of the toast region. */
function toastOf(sweep: Sweep): Locator {
  return sweep.page.locator('#kcp-toast-region > *');
}

async function shot(sweep: Sweep, name: string): Promise<void> {
  const dir = process.env.TOAST_SHOT_DIR;
  if (dir === undefined) return;
  mkdirSync(dir, { recursive: true });
  await sweep.page.screenshot({
    path: join(dir, `${sweep.language}-${String(sweep.width)}-${name}.png`),
  });
}

/** Wait two frames, so a layout a toast set off would have run. */
async function frames(sweep: Sweep): Promise<void> {
  await sweep.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

/**
 * Show a toast and check that nothing in `targets` moves while it shows or after it leaves,
 * and that the toast, whole in the viewport, covers none of the `clear` controls.
 */
async function expectNoShift(
  sweep: Sweep,
  surface: string,
  targets: Record<string, Locator>,
  clear: Record<string, Locator>,
  showToast: () => Promise<void>,
): Promise<void> {
  await frames(sweep);
  const before = await boxes(targets);
  await shot(sweep, `${surface}-before`);
  await showToast();
  const toast = toastOf(sweep);
  await expect(toast).toBeVisible();
  // The entrance on the toast itself plays out first, so the screenshot shows the toast
  // where it rests; the undo toast's drain runs on a child for its whole window.
  await toast.evaluate((node) =>
    Promise.all(node.getAnimations().map((animation) => animation.finished)),
  );
  await frames(sweep);
  await shot(sweep, `${surface}-toast`);
  expect(await boxes(targets), `${surface} while a toast shows`).toEqual(
    before,
  );
  await expect(toast).toBeInViewport({ ratio: 1 });
  const toastBox = await boxOf(toast, 'the toast');
  for (const [name, locator] of Object.entries(clear)) {
    const box = await boxOf(locator, name);
    expect(
      intersects(toastBox, box),
      `${surface}: the toast covers the ${name}`,
    ).toBe(false);
  }
  await dismissToasts(sweep);
  await expect(toast).toHaveCount(0);
  await frames(sweep);
  expect(await boxes(targets), `${surface} after the toast leaves`).toEqual(
    before,
  );
}

for (const language of ['th', 'en'] as const) {
  test(`a toast moves nothing in the plan or the export page in ${language}`, async ({
    context,
  }) => {
    test.setTimeout(300_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const sweep = await openSweep(context, language, []);
    const { page } = sweep;
    for (const width of WIDTHS) {
      await openAt(sweep, width, context);
      const catalog = await showCatalog(sweep);
      await searchSubjectId(sweep, catalog, '90000000', '90000001');
      await addCourse(sweep, '90000001');
      await addCourse(sweep, '90000005');
      await showTimetable(sweep);
      await dismissToasts(sweep);

      const panel = sweep.panel();
      const statusRow = panel.getByRole('group', {
        name: sweep.t('stats.region'),
        exact: true,
      });
      // The grid's own scroller: a removal may scroll the grid inside it as focus moves on to
      // the next block, which is no shift of the layout.
      const grid = panel
        .locator('[data-edit-grid]')
        .filter({ visible: true })
        .locator('xpath=..');
      const nav = page.getByRole('navigation', { name: sweep.t('nav.label') });
      const editTargets = { 'status row': statusRow, grid };
      const editClear = sweep.phone
        ? { 'status row': statusRow, 'bottom nav': nav }
        : { 'status row': statusRow };
      const block = page
        .locator('[data-teach-table-id]')
        .filter({ visible: true })
        .first();

      // An ordinary toast, from copying a block's subject id through its context menu.
      await expectNoShift(
        sweep,
        'copy-toast',
        editTargets,
        editClear,
        async () => {
          await block.click({ button: 'right' });
          await page
            .getByRole('menuitem', { name: sweep.t('block.copySubjectId') })
            .click();
        },
      );

      // The undo toast a removal shows, the toast the owner reported.
      await expectNoShift(
        sweep,
        'undo-toast',
        editTargets,
        editClear,
        async () => {
          await block.click();
          await blockDetail(sweep)
            .getByRole('button', { name: sweep.t('block.removeFromPlan') })
            .click();
          await expect(
            page.getByRole('button', {
              name: sweep.t('action.undo'),
              exact: true,
            }),
          ).toBeVisible();
        },
      );

      await page
        .getByRole('button', { name: sweep.t('mode.export'), exact: true })
        .click();
      const toolbar = page.getByRole('toolbar', {
        name: sweep.t('preview.toolbar'),
      });
      await expect(toolbar).toBeVisible();
      await expectNoShift(
        sweep,
        'export-toast',
        {
          toolbar,
          gallery: panel.locator('[data-gallery-pager]'),
        },
        sweep.phone ? { toolbar } : {},
        async () => {
          await toolbar
            .getByRole('button', {
              name: sweep.t('preview.copyText'),
              exact: true,
            })
            .click();
        },
      );
      await page
        .getByRole('button', { name: sweep.t('mode.backToEdit'), exact: true })
        .click();
    }
  });
}
