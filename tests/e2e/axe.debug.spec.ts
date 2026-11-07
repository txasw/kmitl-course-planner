import { test, expect, expandCourse, openPlanner } from './support/fixtures';
import { axeViolations } from './support/axe';
import { syntheticSearch, addCourse, block } from './support/synthetic';
import {
  TIERS,
  showCatalogByClick,
  showTimetableByClick,
} from './support/tiers';

const OVERLAY = 'KCP: ตัววางแผนตารางเรียน สจล.';

// Runs axe-core against the panel across its surfaces: populated edit mode, the catalog
// filter popover, preview with the sharing toolbar, the display options popover, and the
// import error dialog.
test('the panel passes axe across the edit, preview, and dialog surfaces', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // The host document declares no language, so the panel must carry its own for axe
  // and assistive technology to read the Thai copy with a Thai voice.
  expect(
    await page.evaluate(() => document.documentElement.getAttribute('lang')),
  ).toBeNull();
  await expect(page.getByRole('dialog')).toHaveAttribute('lang', 'th');

  // 1. Populated edit mode, with the added card collapsed and one unadded card open.
  await expect(
    page
      .getByRole('article')
      .filter({ hasText: '90000001' })
      .locator('[data-course-toggle]'),
  ).toHaveAttribute('aria-expanded', 'false');
  await expandCourse(page, '90000003');
  expect(await axeViolations(page)).toEqual([]);

  // 2. The catalog filter popover.
  await page.getByRole('button', { name: 'ตัวกรอง', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'หน่วยกิต' })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');

  // 3. Preview mode with the sharing toolbar.
  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();
  await expect(
    page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }),
  ).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  // 4. The display options popover.
  await page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }).click();
  await expect(page.getByText('แสดงห้อง')).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  // Back to edit for the plan menu.
  await page.getByRole('button', { name: 'แก้ไข' }).click();

  // 5. The import error dialog, reached by feeding a tampered plan JSON.
  await page.getByRole('button', { name: 'เลือกตาราง' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'tampered.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"id":"x","name":"x"}'),
  });
  await expect(
    page.getByText('นำเข้าไม่สำเร็จ ข้อมูลไม่ถูกต้อง'),
  ).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

// Runs axe at each layout tier over the surfaces whose form changes with the width: the
// catalog closed and open, a collapsed result list and one expanded card, the timetable
// with a placed block, the block details, the block context menu, the plan menu, and on
// the docked tiers the column hidden behind the edge rail. The details and the plan menu
// are popovers at 640 px and up and bottom sheets below it.
for (const tier of TIERS) {
  test.describe(`at the ${tier.name} tier`, () => {
    test.use({ viewport: tier.viewport });

    test('the panel passes axe with the catalog and the block and plan surfaces open', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await expect(page.getByRole('dialog', { name: OVERLAY })).toBeVisible();

      // 1. The panel at rest: the sheet closed on the tablet, the search form filling
      // the catalog pane on the phone.
      expect(await axeViolations(page)).toEqual([]);

      // 2. The catalog open with a collapsed result list, then with one card expanded.
      await showCatalogByClick(page);
      await syntheticSearch(page);
      await expect(
        page.locator('[data-course-toggle][aria-expanded="true"]'),
      ).toHaveCount(0);
      expect(await axeViolations(page)).toEqual([]);
      await expandCourse(page, '90000003');
      expect(await axeViolations(page)).toEqual([]);

      // 3. The timetable with a placed block, the sheet closed again on the tablet.
      await addCourse(page, '90000001');
      await showTimetableByClick(page);
      const placed = page.locator(block('900001'));
      await expect(placed).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);

      // 4. The block details, a popover beside the block or a bottom sheet.
      await placed.click();
      const details = page.getByRole('dialog', { name: /กลุ่มเรียน/ });
      await expect(details).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(details).toHaveCount(0);

      // 5. The block context menu.
      await placed.click({ button: 'right' });
      const menu = page.getByRole('menu', { name: 'ตัวเลือกบล็อก' });
      await expect(menu).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);

      // 6. The plan menu.
      await page
        .locator('header')
        .getByRole('button', { name: 'เลือกตาราง' })
        .click();
      const create = page.getByRole('button', { name: 'สร้างตาราง' });
      await expect(create).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(create).toHaveCount(0);

      // 7. On the docked tiers, the column hidden with the edge rail in its place.
      if (tier.kind === 'docked') {
        await page.getByRole('button', { name: 'ซ่อนรายวิชา' }).click();
        await expect(
          page.getByRole('button', { name: /^แสดงรายวิชา/ }),
        ).toBeVisible();
        expect(await axeViolations(page)).toEqual([]);
      }
    });
  });
}
