import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, syntheticSearch } from './support/synthetic';
import { bottomNav, isPhone } from './support/tiers';
import type { Locator, Page } from '@playwright/test';

// The export page at the phone and tablet sizes (ADR-0022 and ADR-0045 amendments of
// 2026-11-21). Back to editing leads the header. Download PNG is the one filled action and
// shows its label at every width; every other sharing action shows a visible label with its
// own glyph, whole inside the viewport. The template picker is a radiogroup of chips, each
// showing its name and output size whole, side by side without overlap, and a tap selects one.

const TEMPLATES = [
  ['แชร์ 16:9', '1920 × 1080'],
  ['ภาพพื้นหลังโทรศัพท์แนวนอน', '2400 × 1080'],
  ['ภาพพื้นหลังโทรศัพท์แนวตั้ง', '1080 × 2340'],
  ['ภาพพื้นหลังแท็บเล็ตแนวตั้ง', '2048 × 2732'],
  ['ภาพพื้นหลังแท็บเล็ตแนวนอน', '2732 × 2048'],
  ['พิมพ์ A4', '3508 × 2480'],
] as const;

/** Add one course to the plan from the catalog pane on the phone or the sheet on the tablet. */
async function planOneCourse(page: Page): Promise<void> {
  if (isPhone(page)) {
    await bottomNav(page)
      .getByRole('button', { name: /^รายวิชา/ })
      .tap();
  } else {
    await page.getByRole('button', { name: /^รายวิชา/ }).click();
  }
  await syntheticSearch(page);
  await addCourse(page, '90000005');
  if (!isPhone(page)) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'ค้นหารายวิชา' })).toHaveCount(
      0,
    );
  }
}

/** Assert a control sits whole in the viewport and its content overflows it nowhere. */
async function expectWhole(control: Locator): Promise<void> {
  await expect(control).toBeInViewport({ ratio: 1 });
  const overflow = await control.evaluate(
    (node) =>
      node.scrollWidth > node.clientWidth + 1 ||
      node.scrollHeight > node.clientHeight + 1,
  );
  expect(overflow).toBe(false);
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

test('the export page leads with a labelled download and names every template', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await planOneCourse(page);
  await page.getByRole('button', { name: 'ส่งออก', exact: true }).click();

  const back = page.getByRole('button', { name: 'กลับไปแก้ไข' });
  await expectWhole(back);
  const backBox = await back.boundingBox();
  // Back leads the export page: it sits at the start of the header row.
  expect(backBox?.x ?? Infinity).toBeLessThan(40);

  const toolbar = page.getByRole('toolbar', { name: 'เครื่องมือสำหรับแชร์' });
  const download = toolbar.getByRole('button', {
    name: 'ดาวน์โหลด PNG',
    exact: true,
  });
  await expect(download).toHaveText('ดาวน์โหลด PNG');
  await expectWhole(download);
  // Download is the only filled action of the toolbar.
  const filled = await toolbar
    .getByRole('button')
    .evaluateAll(
      (nodes) =>
        nodes.filter((node) => node.classList.contains('bg-primary-strong'))
          .length,
    );
  expect(filled).toBe(1);

  // Each secondary action shows a visible label, whole, with a glyph of its own.
  const phone = isPhone(page);
  const actions: [string, string][] = [
    ['คัดลอกรูปภาพ', 'คัดลอกรูปภาพ'],
    ['คัดลอกข้อความ', 'คัดลอกข้อความ'],
    ['ตัวเลือกการแสดงผล', phone ? 'ตัวเลือก' : 'ตัวเลือกการแสดงผล'],
  ];
  if (
    (await toolbar
      .getByRole('button', { name: 'แชร์รูปภาพ', exact: true })
      .count()) > 0
  ) {
    actions.push(['แชร์รูปภาพ', phone ? 'แชร์' : 'แชร์รูปภาพ']);
  }
  const glyphs = new Set<string>();
  for (const [name, shown] of actions) {
    const button = toolbar.getByRole('button', { name, exact: true });
    await expect(button).toContainText(shown);
    await expectWhole(button);
    glyphs.add(
      await button.evaluate(
        (node) =>
          Array.from(node.querySelector('svg')?.classList ?? []).find((name) =>
            name.startsWith('lucide-'),
          ) ?? '',
      ),
    );
  }
  expect(glyphs.size).toBe(actions.length);

  // The picker names every template with its size, whole and without overlap.
  const group = page.getByRole('radiogroup', { name: 'แม่แบบ' });
  const chips = group.getByRole('radio');
  await expect(chips).toHaveCount(TEMPLATES.length);
  const boxes = [];
  for (const [index, [name, size]] of TEMPLATES.entries()) {
    const chip = chips.nth(index);
    await expect(chip).toContainText(name);
    await expect(chip).toContainText(size);
    await expectWhole(chip);
    boxes.push(await chip.boundingBox());
  }
  for (const [index, box] of boxes.entries()) {
    for (const other of boxes.slice(index + 1)) {
      if (box === null || other === null) throw new Error('no chip box');
      expect(overlaps(box, other)).toBe(false);
    }
  }

  const portrait = chips.nth(2);
  await (phone ? portrait.tap() : portrait.click());
  await expect(portrait).toHaveAttribute('aria-checked', 'true');
  await expect(chips.nth(0)).toHaveAttribute('aria-checked', 'false');
  // The choice is marked by a check glyph, not by colour alone.
  await expect(portrait.locator('.lucide-check')).toHaveCount(1);
  await expect(chips.nth(0).locator('.lucide-check')).toHaveCount(0);
});
