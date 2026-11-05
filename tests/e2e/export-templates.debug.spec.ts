import { test, expect, openPlanner, pickOption } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// A PNG stores its pixel dimensions in the IHDR chunk: an 8 byte signature, then a 4
// byte chunk length and the 4 byte type "IHDR", then the width and height as big endian
// uint32 at byte offsets 16 and 20. Decoding them straight from the downloaded bytes
// proves the export landed the exact template pixels, independent of the viewport and
// device pixel ratio, which is the whole point of a fixed template (ADR-0041). Reading
// the four IHDR bytes needs no PNG decoder dependency.
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// The owner 90592xxx category search the other planner specs use, which renders the
// deduped courses with an open, addable section.
async function categorySearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
}

async function downloadPng(page: Page): Promise<Buffer> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ดาวน์โหลดรูปภาพ' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  return readFile(path);
}

test('exports each template at its exact pixel dimensions', async ({
  context,
}) => {
  const page = await openPlanner(context);
  // Reduced motion keeps the capture deterministic: no settle or pulse mid frame.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await categorySearch(page);
  await page
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();

  // Every template lands its exact output pixels through the same capture seam, independent
  // of the viewport. Each is selected through the gallery picker, the dot radiogroup, by its
  // localized name. The set covers both orientations of phone and tablet plus share and print.
  const presets = [
    { name: 'แชร์ 16:9', width: 1920, height: 1080 },
    { name: 'ภาพพื้นหลังโทรศัพท์แนวนอน', width: 2400, height: 1080 },
    { name: 'ภาพพื้นหลังโทรศัพท์แนวตั้ง', width: 1080, height: 2340 },
    { name: 'ภาพพื้นหลังแท็บเล็ตแนวตั้ง', width: 2048, height: 2732 },
    { name: 'ภาพพื้นหลังแท็บเล็ตแนวนอน', width: 2732, height: 2048 },
    { name: 'พิมพ์ A4', width: 3508, height: 2480 },
  ];
  for (const preset of presets) {
    await page.getByRole('radio', { name: new RegExp(preset.name) }).click();
    expect(pngSize(await downloadPng(page))).toEqual({
      width: preset.width,
      height: preset.height,
    });
  }
});

test('keeps verification badges out of the poster and states the data date', async ({
  context,
  mock,
}) => {
  const page = await openPlanner(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await addCourse(page, '90000005');

  // Wait for the automatic check after the first add, then serve the fresh variant, where
  // Course A moved and Course E is gone, and refresh: one entry is changed, one missing.
  const banner = page
    .getByText(/ตรวจสอบแล้ว/)
    .locator('xpath=ancestor::div[1]');
  await expect(banner).toBeVisible({ timeout: 15_000 });
  mock.setFreshSynthetic(true);
  await banner.getByRole('button', { name: 'รีเฟรช' }).click();

  // Edit mode keeps every badge, where the owner can act on it.
  await expect(
    page.locator(`${block('900001')}[data-verify="warn"]`),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator(`${block('900005')}[data-verify="danger"]`),
  ).toBeVisible();

  await page.getByRole('button', { name: 'ดูตัวอย่าง' }).click();

  // The poster, which is the capture node, renders both blocks with no verification mark.
  const posters = page.locator('.kcp-poster');
  await expect(posters.locator(block('900005')).first()).toBeAttached();
  await expect(posters.locator(block('900001')).first()).toBeAttached();
  await expect(posters.locator('[data-verify]')).toHaveCount(0);
  await expect(posters.locator('.kcp-hatch')).toHaveCount(0);

  // The footer states the facts as text instead: the data date, and the missing count.
  const dataLine = posters.locator('[data-poster-data-line]').first();
  await expect(dataLine).toContainText('ข้อมูล ณ');
  await expect(dataLine).toContainText('1 รายวิชาไม่พบในระบบ ณ วันที่ตรวจสอบ');
});
