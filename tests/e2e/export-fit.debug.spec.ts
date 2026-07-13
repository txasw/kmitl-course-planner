import { test, expect, openPlanner } from './support/fixtures';
import { addCourse } from './support/synthetic';
import type { Page } from '@playwright/test';

// The guard the suite lacked. The only earlier preset spec decoded the PNG header bytes and
// so proved the canvas size but never that a block's text fit its box, which is why real
// exports clipped a foot line mid glyph while the suite stayed green. This measures the
// offscreen poster the export rasterizes: every block content wrapper carries a data-fit
// marker, and each must have its scroll height within its client height at the template's true
// pixels, so no field is clipped. Because a wrapping transform only scales the on screen view,
// scrollHeight and clientHeight read the real template pixels, not the scaled ones.

const PRESETS = [
  'แชร์ 16:9',
  'ภาพพื้นหลังโทรศัพท์แนวนอน',
  'ภาพพื้นหลังโทรศัพท์แนวตั้ง',
  'ภาพพื้นหลังแท็บเล็ตแนวตั้ง',
  'ภาพพื้นหลังแท็บเล็ตแนวนอน',
  'พิมพ์ A4',
];

// The reserved id the mock server answers with the fit regression catalog: three hour blocks,
// long Thai and English names, Thai place strings, and a 34 and 35 pair.
async function fitRegressionSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000600');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('90000601').first()).toBeVisible({
    timeout: 15_000,
  });
}

// No block content wrapper overflows its box, so no field is clipped mid glyph, at whatever
// template is selected. Waits for fonts and two frames so the fonts triggered fit convergence
// has committed before the measurement, the same gate the capture waits on.
async function expectNoBlockClips(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
  const boxes = page.locator('[data-fit]');
  const count = await boxes.count();
  expect(count).toBeGreaterThan(0);
  const overflows = await boxes.evaluateAll((els) =>
    els.map((el) => el.scrollHeight - el.clientHeight),
  );
  for (const overflow of overflows) {
    expect(overflow).toBeLessThanOrEqual(0.5);
  }
}

test('no block text clips at any export preset', async ({ context }) => {
  const page = await openPlanner(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fitRegressionSearch(page);
  // Fill the working week with three hour blocks: two Monday and Tuesday lectures, a Wednesday
  // lab, and the Thursday and Friday pair, added as one unit.
  await addCourse(page, '90000601');
  await addCourse(page, '90000602');
  await addCourse(page, '90000603');
  await addCourse(page, '90000634');

  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();

  // Turn the subject id on so the foot carries both the id and the place, the packed shape
  // that clipped in the real exports, and confirm the fit drops fields whole instead.
  await page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }).click();
  await page.getByRole('switch', { name: 'แสดงรหัสวิชา' }).click();
  await page.keyboard.press('Escape');

  for (const preset of PRESETS) {
    await page.getByRole('radio', { name: new RegExp(preset) }).click();
    await expectNoBlockClips(page);
  }
});
