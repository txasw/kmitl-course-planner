import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  openPlanner,
  pickOption,
  waitForResultsInput,
  submitSearch,
} from './support/fixtures';
import { bottomNav, isPhone } from './support/tiers';

// The top of the narrow timetable and the plan status row under it (ADR-0049 amendment),
// on the phone and tablet projects with a plan applied from a curriculum suggestion, so the
// row holds its facts and the suggest action at once. At 360, 390, 768, and 1366 px, in Thai
// and in English, every text leaf of the chip row and the status row shows whole inside the
// viewport and no two leaves overlap.

const WIDTHS = [360, 390, 768, 1366] as const;

/** Search curriculum 137 and apply the first suggestion as a new plan. */
async function planFromSuggestion(page: Page): Promise<void> {
  let catalog: Locator;
  if (isPhone(page)) {
    catalog = page.locator('#kcp-catalog-column');
  } else {
    await page.getByRole('button', { name: /^รายวิชา/ }).click();
    catalog = page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
  }
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '05');
  await pickOption(page, 'หลักสูตร', 'ความปลอดภัยไซเบอร์');
  await submitSearch(catalog);
  await expect(catalog.getByText('01006020').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
  await catalog.getByRole('button', { name: 'แนะนำตาราง' }).click();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await dialog.getByRole('button', { name: 'ใช้ตารางนี้' }).first().click();
  await expect(dialog).toHaveCount(0);
  if (isPhone(page)) {
    await bottomNav(page).getByRole('button', { name: 'ตารางเรียน' }).tap();
  } else {
    await page
      .locator('#kcp-catalog-column')
      .getByRole('button', { name: 'ปิดรายการรายวิชา' })
      .click();
  }
  // The undo toast of the apply floats over the panel foot for its window; dismiss it so
  // the rows read as they rest.
  const toast = page
    .getByRole('button', { name: 'เลิกทำ', exact: true })
    .locator('..');
  await toast.getByRole('button', { name: 'ปิด', exact: true }).click();
  await expect(toast).toHaveCount(0);
}

interface LeafReport {
  text: string;
  clipped: boolean;
  outside: boolean;
}

interface Region {
  leaves: LeafReport[];
  overlaps: string[];
}

/**
 * Read every text leaf under a region: whether its element cuts its text, whether the text
 * leaves the viewport, and which pairs of leaves overlap on screen.
 */
async function readRegion(region: Locator): Promise<Region> {
  return region.evaluate((root) => {
    const rects: { text: string; rect: DOMRect }[] = [];
    const leaves: { text: string; clipped: boolean; outside: boolean }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (text === '' || parent === null) continue;
      if (parent.closest('.sr-only') !== null) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      leaves.push({
        text,
        clipped:
          parent.scrollWidth > parent.clientWidth + 1 ||
          parent.scrollHeight > parent.clientHeight + 1,
        outside: rect.left < 0 || rect.right > window.innerWidth + 0.5,
      });
      rects.push({ text, rect });
    }
    const overlaps: string[] = [];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        if (a === undefined || b === undefined) continue;
        if (
          a.rect.left < b.rect.right - 0.5 &&
          b.rect.left < a.rect.right - 0.5 &&
          a.rect.top < b.rect.bottom - 0.5 &&
          b.rect.top < a.rect.bottom - 0.5
        ) {
          overlaps.push(`${a.text} | ${b.text}`);
        }
      }
    }
    return { leaves, overlaps };
  });
}

async function expectRegionWhole(
  region: Locator,
  label: string,
): Promise<void> {
  const { leaves, overlaps } = await readRegion(region);
  expect(leaves.length, label).toBeGreaterThan(0);
  expect(
    leaves.filter((leaf) => leaf.clipped || leaf.outside),
    label,
  ).toEqual([]);
  expect(overlaps, label).toEqual([]);
}

async function switchToEnglish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
}

test('the chip row and the status row show whole at every width in Thai and English', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await planFromSuggestion(page);
  const languages = [
    { row: 'สรุปตาราง', chips: 'วันที่แสดง', suggest: 'แนะนำตาราง' },
    { row: 'Plan summary', chips: 'Day shown', suggest: 'Suggest' },
  ];
  for (const [index, language] of languages.entries()) {
    if (index === 1) await switchToEnglish(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      const label = `${language.row} at ${String(width)} px`;
      const row = page.getByRole('group', { name: language.row, exact: true });
      await expect(row).toBeVisible();
      await expect(
        row.getByRole('button', { name: language.suggest }),
      ).toBeVisible();
      await expectRegionWhole(row, label);
      const chips = page.getByRole('radiogroup', { name: language.chips });
      if (width < 640) {
        await expect(chips).toBeVisible();
        await expectRegionWhole(
          chips,
          `${language.chips} at ${String(width)} px`,
        );
      }
    }
  }
});
