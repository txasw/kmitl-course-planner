import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Plan } from '../../src/lib/domain/plan';
import {
  test,
  expect,
  openPlanner,
  pickOption,
  waitForResultsInput,
  submitSearch,
} from './support/fixtures';
import { isPhone } from './support/tiers';

// The top of the narrow timetable and the plan status row under it (ADR-0049 amendment),
// on the phone and tablet projects with a plan applied from a curriculum suggestion, so the
// row holds its facts and the suggest action at once. At 360, 390, 768, and 1366 px, in Thai
// and in English, every text leaf of the chip row and the status row shows whole inside the
// viewport and no two leaves overlap. On a phone the status row keeps to two lines, the plan
// facts and then the checks with the suggest action, so the timetable keeps its height
// (ADR-0049 amendment of 2026-11-21). A plan with a time clash holds the widest second line,
// the bordered clash control beside the checks and the suggest action, so it is measured too.

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
  // Applying shows the timetable itself, the phone's pane or the tablet's grid under the
  // closed catalog sheet.
  await expect(dialog).toHaveCount(0);
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
 * Read every text leaf under a region: whether a box around it cuts its text, whether the
 * text leaves the viewport, and which pairs of leaves overlap on screen. An inline element
 * has no client box to measure, so the overflow check reads the nearest box that has one,
 * and every ancestor up to the region that clips its overflow must hold the whole text.
 */
async function readRegion(region: Locator): Promise<Region> {
  return region.evaluate((root) => {
    const rects: { text: string; rect: DOMRect }[] = [];
    const leaves: { text: string; clipped: boolean; outside: boolean }[] = [];
    const hasBox = (element: Element) => {
      const display = getComputedStyle(element).display;
      return display !== 'inline' && display !== 'contents';
    };
    const overflows = (element: Element) =>
      element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1;
    const cutBy = (element: Element, rect: DOMRect) => {
      const style = getComputedStyle(element);
      if (style.overflowX === 'visible' && style.overflowY === 'visible') {
        return false;
      }
      const box = element.getBoundingClientRect();
      return (
        rect.left < box.left - 0.5 ||
        rect.right > box.right + 0.5 ||
        rect.top < box.top - 0.5 ||
        rect.bottom > box.bottom + 0.5
      );
    };
    const clippedAt = (start: Element, rect: DOMRect) => {
      let box: Element | null = start;
      while (box !== null && !hasBox(box)) box = box.parentElement;
      if (box !== null && overflows(box)) return true;
      for (
        let element: Element | null = start;
        element !== null;
        element = element === root ? null : element.parentElement
      ) {
        if (cutBy(element, rect)) return true;
      }
      return false;
    };
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
        clipped: clippedAt(parent, rect),
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

/**
 * Read the phone status row: how many tiers it holds, and for each tier how far it stands
 * taller than its tallest item, which is above zero only when the tier wraps onto a second line.
 */
async function readTiers(row: Locator): Promise<number[]> {
  return row.evaluate((root) =>
    Array.from(root.children).map((tier) => {
      const items = Array.from(tier.children).map(
        (item) => item.getBoundingClientRect().height,
      );
      return tier.getBoundingClientRect().height - Math.max(0, ...items);
    }),
  );
}

async function expectTwoLines(row: Locator, label: string): Promise<void> {
  const tiers = await readTiers(row);
  expect(tiers, label).toHaveLength(2);
  for (const extra of tiers) expect(extra, label).toBeLessThanOrEqual(1);
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
      if (width < 640) await expectTwoLines(row, label);
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

/** Export the active plan, add a copy of its first entry under another subject at the same
 * times, and import it, so the new active plan holds one time clash. */
async function importClashingCopy(page: Page): Promise<void> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'เลือกตาราง' }).click();
  await page.getByRole('button', { name: 'ส่งออก JSON' }).click();
  const exported = readFileSync(await (await downloadPromise).path(), 'utf8');
  // The export is the plan the app validated through its schema before writing it, so the
  // test reads it as that shape to write the clashing copy into it.
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
      subjectMeta: { ...first.snapshot.subjectMeta, subjectId: ids.subjectId },
    },
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'clash.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  });
}

test('the phone status row keeps to two lines with a clash in Thai and English', async ({
  context,
}) => {
  const page = await openPlanner(context);
  test.skip(!isPhone(page), 'the two line row is the phone layout');
  await planFromSuggestion(page);
  await importClashingCopy(page);
  const languages = [
    { row: 'สรุปตาราง', clash: /^ชนกัน 1 รายการ/ },
    { row: 'Plan summary', clash: /^Conflicts: 1/ },
  ];
  for (const [index, language] of languages.entries()) {
    if (index === 1) await switchToEnglish(page);
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const label = `${language.row} with a clash at ${String(width)} px`;
      const row = page.getByRole('group', { name: language.row, exact: true });
      await expect(
        row.getByRole('button', { name: language.clash }),
      ).toBeVisible({
        timeout: 15_000,
      });
      await expectRegionWhole(row, label);
      await expectTwoLines(row, label);
    }
  }
});
