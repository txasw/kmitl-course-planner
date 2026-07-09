import { test, expect, openPlanner } from './support/fixtures';
import type { Page } from '@playwright/test';

// A placed grid block carries a data-teach-table-id, so a specific section is
// targeted by its synthetic fixture id.
const block = (id: string) => `[data-teach-table-id="${id}"]`;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The by subject id search is served a synthetic catalog for the reserved id
// 90000000: Course A (Mon 09-11), Course B (Mon 10-12, overlaps A), Course C (two
// non overlapping sections), Course E (Tue 13-15), and Course X (a pair whose halves
// overlap A and E). This gives clean move, swap, and still conflicting swap cases the
// captured fixtures cannot.
async function syntheticSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000000');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('90000001').first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Add the first section of a course by its subject id. */
async function addCourse(page: Page, subjectId: string): Promise<void> {
  await page
    .getByRole('article')
    .filter({ hasText: subjectId })
    .first()
    .getByRole('button', { name: 'เพิ่ม', exact: true })
    .first()
    .click();
}

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Press a source point, move past the activation distance to arm the drag and reveal
 * the transient drop targets, locate the target, drop on it. The target is resolved
 * mid drag because the remove zone, candidate slots, and swap targets only exist
 * while a drag is live.
 */
async function dragOnto(
  page: Page,
  source: Box,
  locateTarget: () => Promise<Box>,
): Promise<void> {
  const from = center(source);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 24, from.y + 12, { steps: 6 });
  const target = center(await locateTarget());
  await page.mouse.move(target.x, target.y, { steps: 15 });
  await page.mouse.up();
  // dnd-kit suppresses the click immediately after a drop for 50 ms; wait past that
  // window so a following click, such as undo, is not swallowed. A real user is far
  // slower than this, so it only matters for the automated sequence.
  await page.waitForTimeout(120);
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const located = page.locator(selector).first();
  await located.waitFor();
  const box = await located.boundingBox();
  if (box === null) {
    throw new Error(`no bounding box for ${selector}`);
  }
  return box;
}

test('removes a placed block by dragging it to the remove zone, with undo', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  await dragOnto(page, await boxOf(page, block('900001')), () =>
    boxOf(page, '[data-remove-zone]'),
  );
  await expect(page.locator(block('900001'))).toHaveCount(0);

  await page.getByRole('button', { name: 'เลิกทำ' }).click();
  await expect(page.locator(block('900001'))).toBeVisible();
});

test('moves a placed section onto another section of the same subject', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  // Course C section 901 (id 900003); the move target is section 902 (id 900004).
  await addCourse(page, '90000003');
  await expect(page.locator(block('900003'))).toBeVisible();

  await dragOnto(page, await boxOf(page, block('900003')), () =>
    boxOf(page, '[data-candidate="valid"]'),
  );

  await expect(page.locator(block('900003'))).toHaveCount(0);
  await expect(page.locator(block('900004'))).toBeVisible();
});

test('swaps a blocking section on a conflicting drop, with undo', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  // Course A occupies Mon 09-11; Course B overlaps it at Mon 10-12.
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  const gripB = page
    .getByRole('article')
    .filter({ hasText: '90000002' })
    .first()
    .getByRole('button', { name: /ลากเพื่อเพิ่ม/ })
    .first();
  const gripBox = await gripB.boundingBox();
  expect(gripBox).not.toBeNull();
  if (gripBox === null) {
    return;
  }
  await dragOnto(page, gripBox, () => boxOf(page, '[data-swap-target]'));

  // A is exchanged for B.
  await expect(page.locator(block('900001'))).toHaveCount(0);
  await expect(page.locator(block('900002'))).toBeVisible();

  await page.getByRole('button', { name: 'เลิกทำ' }).click();
  await expect(page.locator(block('900001'))).toBeVisible();
  await expect(page.locator(block('900002'))).toHaveCount(0);
});

test('rejects a swap that still conflicts after removing the blocker', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  // A (Mon 09-11) and E (Tue 13-15) both blocked by X's two halves.
  await addCourse(page, '90000001');
  await addCourse(page, '90000005');
  await expect(page.locator(block('900001'))).toBeVisible();
  await expect(page.locator(block('900005'))).toBeVisible();
  // Capture A's cell so the drop lands on A's swap target, not E's.
  const aBox = await boxOf(page, block('900001'));

  const gripX = page
    .getByRole('article')
    .filter({ hasText: '90000006' })
    .first()
    .getByRole('button', { name: /ลากเพื่อเพิ่ม/ })
    .first();
  const gripBox = await gripX.boundingBox();
  expect(gripBox).not.toBeNull();
  if (gripBox === null) {
    return;
  }
  // Drop on A's swap target: removing A leaves X's second half clashing with E.
  await dragOnto(page, gripBox, async () => {
    await page.locator('[data-swap-target]').first().waitFor();
    return aBox;
  });

  // Nothing changed: A stays, X is not added.
  await expect(page.locator(block('900001'))).toBeVisible();
  await expect(page.locator(block('900006'))).toHaveCount(0);
  await expect(page.locator(block('900007'))).toHaveCount(0);
});
