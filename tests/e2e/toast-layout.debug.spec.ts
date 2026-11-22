import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator } from '@playwright/test';
import {
  test,
  expect,
  editSearch,
  expandCourse,
  openPlanner,
  pickOption,
  submitSearch,
} from './support/fixtures';
import {
  addCourse as addSynthetic,
  syntheticSearch,
} from './support/synthetic';
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
 * and that the toast, whole in the viewport, covers none of the `clear` controls. When the
 * action that shows the toast also changes the plan (a removal shows the undo toast), the
 * status row may rewrap for its new text, so the layout while the toast shows is compared
 * with the layout once it leaves, both after the change, rather than with the one before.
 */
async function expectNoShift(
  sweep: Sweep,
  surface: string,
  targets: Record<string, Locator>,
  clear: Record<string, Locator>,
  showToast: () => Promise<void>,
  options: { changesPlan?: boolean } = {},
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
  const during = await boxes(targets);
  if (options.changesPlan !== true) {
    expect(during, `${surface} while a toast shows`).toEqual(before);
  }
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
    options.changesPlan === true ? during : before,
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

        { changesPlan: true },
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

// A bottom sheet makes no room for a toast either. Its body keeps the room at rest and the
// toast floats over it, above the sheet's footer of actions, so the sheet, its body, and its
// footer keep their boxes before a toast shows, while it shows, and after it leaves. The block
// detail sheet at 360 and 390 px carries a footer, and its copy subject id action, the last row
// of its body, shows a toast while the sheet stays open; with the body scrolled to its end, the
// toast covers neither that row nor the footer.
for (const language of ['th', 'en'] as const) {
  test(`a toast moves nothing in an open bottom sheet in ${language}`, async ({
    context,
  }) => {
    test.setTimeout(120_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const sweep = await openSweep(context, language, []);
    const { page } = sweep;
    for (const width of [360, 390] as const) {
      await openAt(sweep, width, context);
      const catalog = await showCatalog(sweep);
      await searchSubjectId(sweep, catalog, '90000000', '90000001');
      await addCourse(sweep, '90000001');
      await showTimetable(sweep);
      await dismissToasts(sweep);

      await page
        .locator('[data-teach-table-id]')
        .filter({ visible: true })
        .first()
        .click();
      const sheet = blockDetail(sweep);
      await expect(sheet).toBeVisible();
      await sheet.evaluate((node) =>
        Promise.all(
          node.getAnimations().map((animation) => animation.finished),
        ),
      );
      const copyButton = page.getByRole('button', {
        name: sweep.t('block.copySubjectId'),
      });
      const copy = sheet.locator(copyButton);
      const body = sheet.locator(':scope > div').filter({ has: copyButton });
      const footer = sheet.locator(':scope > div').filter({
        has: page.getByRole('button', {
          name: sweep.t('block.removeFromPlan'),
        }),
      });
      // Bring the last row of the body as far up as the body scrolls.
      await body.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expectNoShift(
        sweep,
        'sheet-toast',
        { sheet, body, footer, 'copy action': copy },
        { footer, 'copy action': copy },
        async () => {
          await copy.click();
        },
      );
      await expect(sheet).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
    }
  });
}

// The unscheduled shelf sits between the timetable and the status row and scrolls with
// neither, so it counts as part of the foot: a toast floats above it rather than over its
// rows, which no scroll could bring clear of the toast, and the shelf does not move.
test('a toast floats above the unscheduled shelf and moves nothing', async ({
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
  await page
    .getByRole('article')
    .filter({ hasText: '01006029' })
    .first()
    .getByRole('button', { name: /^เพิ่ม/ })
    .click();
  await editSearch(page);
  await syntheticSearch(page);
  await addSynthetic(page, '90000001');

  const shelf = page.getByRole('region', { name: 'รายวิชาที่ไม่มีคาบเรียน' });
  const statusRow = page.getByRole('group', { name: 'สรุปตาราง', exact: true });
  await expect(shelf).toBeVisible();
  const before = await boxes({ shelf, 'status row': statusRow });

  await page
    .locator('[data-teach-table-id]')
    .first()
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'คัดลอกรหัสวิชา' }).click();
  const toast = page.locator('#kcp-toast-region > *');
  await expect(toast).toBeVisible();
  await toast.evaluate((node) =>
    Promise.all(node.getAnimations().map((animation) => animation.finished)),
  );
  const during = await boxes({ shelf, 'status row': statusRow });
  expect(during).toEqual(before);
  const toastBox = await boxOf(toast, 'the toast');
  for (const [name, box] of Object.entries(during)) {
    expect(intersects(toastBox, box), `the toast covers the ${name}`).toBe(
      false,
    );
  }
});
