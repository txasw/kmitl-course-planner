import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import { readFileSync } from 'node:fs';

// The Phase 7 data management flows: the preview sharing toolbar appears only in
// preview mode, and a plan round trips through JSON export and import to a new
// unverified plan that revalidation reconciles on open. These run against the
// synthetic by subject id catalog so the section is known and stable.

test('shows the sharing toolbar only in preview mode', async ({ context }) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // Edit mode carries no sharing controls.
  await expect(
    page.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'คัดลอกข้อความ' })).toHaveCount(
    0,
  );

  // Preview mode reveals the display options and the sharing actions.
  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();
  await expect(
    page.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'คัดลอกข้อความ' }),
  ).toBeVisible();

  // Returning to edit removes them from the DOM again.
  await page.getByRole('button', { name: 'แก้ไข' }).click();
  await expect(
    page.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }),
  ).toHaveCount(0);
});

test('round trips a plan through JSON export and import', async ({
  context,
  mock,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // Wait for the automatic check on the new plan so the export is a verified plan.
  await expect(page.getByText(/ตรวจสอบแล้ว/)).toBeVisible({ timeout: 15_000 });

  // Export the plan through the plan menu and read the downloaded JSON.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'เลือกตาราง' }).click();
  await page.getByRole('button', { name: 'ส่งออก JSON' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = readFileSync(path, 'utf8');

  // Import the file: the new plan lands unverified and active, so revalidation
  // runs on open and its section renders on the grid from the imported snapshot.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  });
  await expect(page.locator(block('900001'))).toBeVisible();
  const banner = page
    .getByText(/ตรวจสอบแล้ว/)
    .locator('xpath=ancestor::div[1]');
  await expect(banner).toBeVisible({ timeout: 15_000 });

  // Serve the moved variant and refresh from the banner, which bypasses the cache:
  // the imported entries reconcile against fresh data, report one change, and the
  // block carries the warn badge.
  mock.setFreshSynthetic(true);
  await banner.getByRole('button', { name: 'รีเฟรช' }).click();
  await expect(page.getByText(/เปลี่ยน 1/)).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(`${block('900001')}[data-verify="warn"]`),
  ).toBeVisible();
  // Import never overwrites: the name collided with the original, so the imported
  // plan carries the de-collision suffix, which means the original still exists. The
  // per-row action buttons repeat the name, so target the first match, the select row.
  await page.getByRole('button', { name: 'เลือกตาราง' }).click();
  await expect(
    page.getByRole('button', { name: /\(2\)$/ }).first(),
  ).toBeVisible();
});
