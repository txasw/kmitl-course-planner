import { test, expect, openPlanner } from './support/fixtures';
import { syntheticSearch, addCourse, block } from './support/synthetic';
import type { Page } from '@playwright/test';

// Runs axe-core against the panel across its surfaces: populated edit mode, the catalog
// filter popover, preview with the sharing toolbar, the display options popover, and the
// import error dialog. axe is pointed at the extension's shadow root so it sees the mounted
// UI, and
// the run is limited to the WCAG 2 A and AA rules. Contrast is checked separately in the
// token contrast unit test, because axe cannot resolve the shadow root token backgrounds.
const AXE_PATH = 'node_modules/axe-core/axe.min.js';

async function axeViolations(
  page: Page,
): Promise<{ id: string; impact: string }[]> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const runner = (
      window as unknown as {
        axe: {
          run: (
            context: unknown,
            options: unknown,
          ) => Promise<{ violations: { id: string; impact: string }[] }>;
        };
      }
    ).axe;
    const host = Array.from(document.body.children).find(
      (el) => el.shadowRoot !== null,
    );
    const root = host?.shadowRoot ?? document;
    const result = await runner.run(root, { runOnly: ['wcag2a', 'wcag2aa'] });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact }));
  });
}

test('the panel passes axe across the edit, preview, and dialog surfaces', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // 1. Populated edit mode.
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
