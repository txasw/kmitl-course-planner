import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, syntheticSearch } from './support/synthetic';
import { bottomNav, isPhone } from './support/tiers';
import { holdWork } from './support/holdWork';
import type { Locator, Page } from '@playwright/test';

// The export page at the phone and tablet sizes (ADR-0022 and ADR-0045 amendments of
// 2026-11-21). Back to editing leads the header. Download PNG is the one filled action and
// shows its label at every width; every other sharing action shows a visible label with its
// own glyph, whole inside the viewport. The template picker is a radiogroup of chips, each
// showing its name and output size whole, side by side without overlap, and a tap selects one,
// down to the 320 px narrowest width. Below 640 px each chip shows a short name on a compact
// line in two rows, its full name and size are its accessible name, and the line under the
// stage names the selected template in full with its size (ADR-0045 amendment of 2026-11-21).

const TEMPLATES = [
  ['แชร์ 16:9', 'แชร์ 16:9', '1920 × 1080'],
  ['ภาพพื้นหลังโทรศัพท์แนวนอน', 'โทรศัพท์ แนวนอน', '2400 × 1080'],
  ['ภาพพื้นหลังโทรศัพท์แนวตั้ง', 'โทรศัพท์ แนวตั้ง', '1080 × 2340'],
  ['ภาพพื้นหลังแท็บเล็ตแนวตั้ง', 'แท็บเล็ต แนวตั้ง', '2048 × 2732'],
  ['ภาพพื้นหลังแท็บเล็ตแนวนอน', 'แท็บเล็ต แนวนอน', '2732 × 2048'],
  ['พิมพ์ A4', 'พิมพ์ A4', '3508 × 2480'],
] as const;

/** The tallest the compact picker may stand on a phone: two rows of 44 px chips and a gap. */
const COMPACT_PICKER_MAX_PX = 100;

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

/** Open the export page and check its header, toolbar, and template chips at the page size. */
async function checkExportPage(page: Page): Promise<void> {
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
  // Read as rendered: the busy label waits hidden beside the label, holding its width.
  await expect(download).toHaveText('ดาวน์โหลด PNG', { useInnerText: true });
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
  const compact = (page.viewportSize()?.width ?? 0) < 640;
  const boxes = [];
  for (const [index, [name, short, size]] of TEMPLATES.entries()) {
    const chip = chips.nth(index);
    await expect(chip).toHaveAccessibleName(`${name} · ${size}`);
    if (compact) {
      await expect(chip.locator('[data-template-short]')).toHaveText(short);
      expect((await chip.boundingBox())?.height ?? 0).toBeLessThanOrEqual(46);
    } else {
      await expect(chip).toContainText(name);
      await expect(chip).toContainText(size);
    }
    await expectWhole(chip);
    // The size line does not wrap, so it has to fit the chip's content box, not only its
    // border box, or it runs into the padding at the narrowest width.
    const room = await chip.evaluate((node) => {
      const style = getComputedStyle(node);
      const content =
        node.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      return content - (node.lastElementChild?.scrollWidth ?? Infinity);
    });
    expect(room).toBeGreaterThanOrEqual(0);
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
  await expect(
    portrait.locator('.lucide-check').filter({ visible: true }),
  ).toHaveCount(1);
  await expect(chips.nth(0).locator('.lucide-check')).toHaveCount(0);
  if (compact) {
    // The compact picker gives its height to the stage, and the line under the stage names
    // the selected template in full.
    expect((await group.boundingBox())?.height ?? 0).toBeLessThanOrEqual(
      COMPACT_PICKER_MAX_PX,
    );
    const caption = page.locator('[data-template-caption]');
    await expect(caption).toHaveText('ภาพพื้นหลังโทรศัพท์แนวตั้ง · 1080 × 2340');
    await expectWhole(caption);
  }
}

test('the export page leads with a labelled download and names every template', async ({
  context,
}) => {
  await checkExportPage(await openPlanner(context));
});

// The narrowest width the panel supports, where three chips share 288 px of row and the
// size line of each is tightest.
test('the export actions and template chips show whole at 320 px', async ({
  context,
}) => {
  const page = await openPlanner(context);
  test.skip(!isPhone(page), 'the 320 px width is a phone width');
  await page.setViewportSize({ width: 320, height: 640 });
  await checkExportPage(page);
});

// A phone turned on its side: the chips take one row, so the poster stage keeps its height.
test('the template chips share one row on a phone turned on its side', async ({
  context,
}) => {
  const page = await openPlanner(context);
  test.skip(
    (page.viewportSize()?.width ?? 0) >= 640,
    'the landscape case starts from a phone',
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await checkExportPage(page);
  const tops = await page
    .getByRole('radiogroup', { name: 'แม่แบบ' })
    .getByRole('radio')
    .evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
  expect(new Set(tops).size).toBe(1);
});

/** Every button box of a toolbar, to prove a busy label moves nothing. */
async function buttonBoxes(toolbar: Locator): Promise<string[]> {
  return toolbar.getByRole('button').evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height].map(Math.round).join(',');
    }),
  );
}

/**
 * The vertical centers of the toolbar's actions that share one row: the whole toolbar on the
 * tablet, and the action row under download on the phone.
 */
async function restCenters(
  toolbar: Locator,
  phone: boolean,
): Promise<number[]> {
  const names = [
    'แชร์รูปภาพ',
    'คัดลอกรูปภาพ',
    'คัดลอกข้อความ',
    'ตัวเลือกการแสดงผล',
    ...(phone ? [] : ['ดาวน์โหลด PNG']),
  ];
  const centers: number[] = [];
  for (const name of names) {
    const button = toolbar.getByRole('button', { name, exact: true });
    if ((await button.count()) === 0) continue;
    const box = await button.boundingBox();
    if (box === null) throw new Error(`no box for ${name}`);
    centers.push(box.y + box.height / 2);
  }
  return centers;
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

// A capture on a slow phone, or a clipboard that answers late, used to leave the page silent
// until the toast (ADR-0027 amendment of 2026-11-22). The work is held here so the busy state
// stands long enough to check: the toolbar at rest keeps its row and alignment, the pressed
// action keeps focus, shows a spinner and names the work, the others wait, nothing in
// the toolbar moves, and the toast still ends it.
test('an export action shows a busy state until its toast, moving nothing', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await planOneCourse(page);
  await page.getByRole('button', { name: 'ส่งออก', exact: true }).click();
  const toolbar = page.getByRole('toolbar', { name: 'เครื่องมือสำหรับแชร์' });
  const download = toolbar.getByRole('button', {
    name: 'ดาวน์โหลด PNG',
    exact: true,
  });
  await expect(download).toBeVisible();
  // At rest the toolbar keeps the layout it had before the busy state: on the tablet in Thai the
  // five actions share one row, so no busy label widens a button enough to wrap it.
  expect(spread(await restCenters(toolbar, isPhone(page)))).toBeLessThanOrEqual(
    1,
  );
  await holdWork(page, 2_500);

  const copyText = toolbar.getByRole('button', {
    name: 'คัดลอกข้อความ',
    exact: true,
  });
  for (const [action, busyName, done] of [
    [download, 'กำลังสร้างรูปภาพ', 'ดาวน์โหลดรูปภาพแล้ว'],
    [copyText, 'กำลังคัดลอก', 'คัดลอกข้อความแล้ว'],
  ] as const) {
    await action.scrollIntoViewIfNeeded();
    const before = await buttonBoxes(toolbar);
    await action.focus();
    await page.keyboard.press('Enter');
    const busy = toolbar.getByRole('button', { name: busyName, exact: true });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy).toBeFocused();
    await expect(busy.locator('svg')).toHaveClass(/lucide-loader-circle/);
    await expect(toolbar).toHaveAttribute('aria-busy', 'true');
    await expect(
      toolbar.getByRole('button', { name: 'คัดลอกรูปภาพ', exact: true }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(await buttonBoxes(toolbar)).toEqual(before);

    await expect(page.getByText(done)).toBeVisible({ timeout: 10_000 });
    await expect(busy).toHaveCount(0);
    await expect(toolbar).toHaveAttribute('aria-busy', 'false');
  }
});
