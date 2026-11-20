import { test, expect, openPlanner, submitSearch } from './support/fixtures';
import { addCourse } from './support/synthetic';
import type { Page } from '@playwright/test';

// The guard the suite lacked. The only earlier preset spec decoded the PNG header bytes and
// so proved the canvas size but never that a block's text fit its box, which is why real
// exports clipped a foot line mid glyph while the suite stayed green. This measures the
// offscreen poster the export rasterizes: every block content wrapper carries a data-fit
// marker, and each must have its scroll height within its client height at the template's true
// pixels, so no field is clipped. Because a wrapping transform only scales the on screen view,
// scrollHeight and clientHeight read the real template pixels, not the scaled ones.
//
// Width is measured too (the ADR-0046 amendment of 2026-11-20). The subject id and the time are
// whole fields on one line that never wraps, so at every preset each one present must fit its
// line, and a block too narrow for one shows none of it rather than a code cut at its edge.

const PRESETS = [
  'แชร์ 16:9',
  'ภาพพื้นหลังโทรศัพท์แนวนอน',
  'ภาพพื้นหลังโทรศัพท์แนวตั้ง',
  'ภาพพื้นหลังแท็บเล็ตแนวตั้ง',
  'ภาพพื้นหลังแท็บเล็ตแนวนอน',
  'พิมพ์ A4',
];

const PRESETS_EN = [
  'Share 16:9',
  'Phone wallpaper landscape',
  'Phone wallpaper portrait',
  'Tablet wallpaper portrait',
  'Tablet wallpaper landscape',
  'Print A4',
];

// The reserved id the mock server answers with the fit regression catalog: three hour blocks,
// long Thai and English names, Thai place strings, a 34 and 35 pair, exam windows on every
// three hour subject but 90000603, which the exam block lists as arranged by the instructor,
// and a one hour and a ninety minute block, the narrow landscape shapes the id clipped on.
async function fitRegressionSearch(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000600');
  await submitSearch(page);
  await expect(page.getByText('90000601').first()).toBeVisible({
    timeout: 15_000,
  });
}

// No block content wrapper overflows its box, so no field is clipped mid glyph, at whatever
// template is selected. Waits for fonts and two frames so the fonts triggered fit convergence
// has committed before the measurement, the same gate the capture waits on.
async function settle(page: Page): Promise<void> {
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
}

async function expectNoBlockClips(page: Page): Promise<void> {
  await settle(page);
  const boxes = page.locator('[data-fit]');
  const count = await boxes.count();
  expect(count).toBeGreaterThan(0);
  const overflows = await boxes.evaluateAll((els) =>
    els.map((el) => ({
      down: el.scrollHeight - el.clientHeight,
      across: el.scrollWidth - el.clientWidth,
    })),
  );
  for (const overflow of overflows) {
    expect(overflow.down).toBeLessThanOrEqual(0.5);
    expect(overflow.across).toBeLessThanOrEqual(0.5);
  }
}

/** Every whole field on the poster blocks fits its own line, and every subject id present
 * reads as its whole eight digit code on one line. Returns how many ids show. */
async function expectWholeFields(page: Page, label: string): Promise<number> {
  await settle(page);
  const fields = await page.locator('[data-fit-whole]').evaluateAll((els) =>
    els.map((el) => ({
      field: el instanceof HTMLElement ? (el.dataset.fitWhole ?? '') : '',
      text: el.textContent,
      across: el.scrollWidth - el.clientWidth,
      lines:
        el instanceof HTMLElement
          ? Math.round(
              el.offsetHeight / parseFloat(getComputedStyle(el).lineHeight),
            )
          : 0,
    })),
  );
  for (const field of fields) {
    expect(
      field.across,
      `${label} ${field.field} ${field.text}`,
    ).toBeLessThanOrEqual(0.5);
    expect(field.lines, `${label} ${field.field} ${field.text}`).toBe(1);
  }
  const ids = fields.filter((field) => field.field === 'id');
  for (const id of ids) {
    expect(id.text, label).toMatch(/^\d{8}$/);
  }
  return ids.length;
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
  await addCourse(page, '90000605');
  await addCourse(page, '90000606');

  await page.getByRole('button', { name: 'ส่งออก', exact: true }).click();

  // Turn the subject id on so the foot carries both the id and the place, the packed shape
  // that clipped in the real exports, and confirm the fit drops fields whole instead.
  await page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }).click();
  await page.getByRole('switch', { name: 'แสดงรหัสวิชา' }).click();
  await page.keyboard.press('Escape');

  for (const preset of PRESETS) {
    await page.getByRole('radio', { name: new RegExp(preset) }).click();
    await expectNoBlockClips(page);
    await expect(page.locator('[data-poster-exams]')).toHaveCount(0);
  }

  // The width rule per template, in each name language: every id and time shown fits its
  // line whole, and the wide three hour blocks keep the id so the check is never vacuous.
  for (const names of ['ไทย', 'อังกฤษ', 'ทั้งสองภาษา']) {
    await page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }).click();
    await page
      .getByRole('group', { name: 'ชื่อวิชา' })
      .getByRole('button', { name: names, exact: true })
      .click();
    await page.keyboard.press('Escape');
    for (const preset of PRESETS) {
      await page.getByRole('radio', { name: new RegExp(preset) }).click();
      await expectNoBlockClips(page);
      const shown = await expectWholeFields(page, `${preset} ${names}`);
      expect(shown, `${preset} ${names}`).toBeGreaterThan(0);
    }
  }

  // The exam schedule takes up to a quarter of the poster height from the grid. Its box carries
  // the data-fit marker too, so the same guard proves neither an exam line nor a grid block
  // clips under the reduced height, at every preset.
  await page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }).click();
  await page.getByRole('switch', { name: 'แสดงตารางสอบ' }).click();
  await page.keyboard.press('Escape');

  for (const preset of PRESETS) {
    await page.getByRole('radio', { name: new RegExp(preset) }).click();
    await expectNoBlockClips(page);
    const exams = page.locator('[data-poster-exams]').first();
    await expect(exams).toContainText('ตารางสอบ');
    await expect(exams).toContainText('กลางภาค');
  }

  // The width rule again under the English panel, the worst case: the primary names are the
  // long capitalized English ones, so the blocks drop the most ids. A preset may then show
  // none, so the check that it is not vacuous counts the ids across the whole pass.
  await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Display options' }).click();
  await page.getByRole('switch', { name: 'Show exam schedule' }).click();
  await page.keyboard.press('Escape');
  for (const names of ['Thai', 'English', 'Both']) {
    await page.getByRole('button', { name: 'Display options' }).click();
    await page
      .getByRole('group', { name: 'Subject names' })
      .getByRole('button', { name: names, exact: true })
      .click();
    await page.keyboard.press('Escape');
    let shown = 0;
    for (const preset of PRESETS_EN) {
      await page.getByRole('radio', { name: new RegExp(preset) }).click();
      await expectNoBlockClips(page);
      shown += await expectWholeFields(page, `${preset} ${names} en panel`);
    }
    expect(shown, `${names} en panel`).toBeGreaterThan(0);
  }
});
