import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import { tap, type Point } from './support/touch';
import type { Locator, Page } from '@playwright/test';

// The edge rail of ADR-0048 on the docked tiers: it takes the hidden column's place with
// its icon on the hide control's icon, it restores the column with the scroll offset the
// column kept, it takes no pointer events during a drag, and a tap opens it on a touch
// screen.

const COLUMN = '#kcp-catalog-column';
const HIDE = 'ซ่อนรายวิชา';
const RAIL = /^แสดงรายวิชา/;

// The show and hide funnel ignores a pointer toggle within 200 ms of the previous one, so
// the hide control and the rail sharing one point cannot undo each other on a quick
// second click. A scripted sequence clicks far faster than a person, so it waits past
// that window before the next pointer toggle.
const PAST_POINTER_GUARD_MS = 250;

async function iconCentre(control: Locator): Promise<Point> {
  const box = await control.locator('svg').first().boundingBox();
  if (box === null) throw new Error('the control icon has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function centre(control: Locator): Promise<Point> {
  const box = await control.boundingBox();
  if (box === null) throw new Error('the control has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Scroll the catalog scroller down and return the offset it settled at. */
async function scrollCatalog(page: Page): Promise<number> {
  return page.locator(`${COLUMN} > .kcp-scroll`).evaluate((node) => {
    node.scrollTop = 160;
    return node.scrollTop;
  });
}

async function catalogOffset(page: Page): Promise<number> {
  return page
    .locator(`${COLUMN} > .kcp-scroll`)
    .evaluate((node) => node.scrollTop);
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`at ${String(viewport.width)} by ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('the rail sits where the hide control was and restores the column as it was', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await syntheticSearch(page);
      const offset = await scrollCatalog(page);
      expect(offset).toBeGreaterThan(0);

      const hide = page.getByRole('button', { name: HIDE });
      const hideIcon = await iconCentre(hide);
      await hide.click();

      const rail = page.getByRole('button', { name: RAIL });
      await expect(rail).toBeFocused();
      await expect(page.locator(COLUMN)).toHaveAttribute('inert');
      const railIcon = await iconCentre(rail);
      expect(Math.abs(railIcon.x - hideIcon.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(railIcon.y - hideIcon.y)).toBeLessThanOrEqual(2);
      await expect(rail).not.toHaveAttribute('aria-expanded');
      await expect(rail).not.toHaveAttribute('title');

      await page.waitForTimeout(PAST_POINTER_GUARD_MS);
      await rail.click();
      await expect(page.locator(COLUMN)).not.toHaveAttribute('inert');
      await expect(page.getByRole('button', { name: HIDE })).toBeFocused();
      await expect(rail).toHaveCount(0);
      expect(await catalogOffset(page)).toBe(offset);
    });

    test('the rail takes no pointer events during a block drag', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await syntheticSearch(page);
      await addCourse(page, '90000001');
      const placed = page.locator(block('900001'));
      await expect(placed).toBeVisible();

      await page.getByRole('button', { name: HIDE }).click();
      const rail = page.getByRole('button', { name: RAIL });
      await expect(rail).toBeVisible();
      await expect(rail).toHaveCSS('pointer-events', 'auto');

      const from = await centre(placed);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 24, from.y + 12, { steps: 6 });
      await expect(rail).toHaveAttribute('data-dragging', 'true');
      await expect(rail).toHaveCSS('pointer-events', 'none');
      await page.mouse.up();

      await expect(rail).not.toHaveAttribute('data-dragging');
      await expect(rail).toHaveCSS('pointer-events', 'auto');
      await expect(page.locator(COLUMN)).toHaveAttribute('inert');
    });
  });
}

test.describe('on a touch screen at 1180 by 820', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('a tap on the rail opens the hidden column', async ({ context }) => {
    const page = await openPlanner(context);
    await tap(page, await centre(page.getByRole('button', { name: HIDE })));
    const rail = page.getByRole('button', { name: RAIL });
    await expect(rail).toBeVisible();

    await page.waitForTimeout(PAST_POINTER_GUARD_MS);
    await tap(page, await centre(rail));
    await expect(page.locator(COLUMN)).not.toHaveAttribute('inert');
    await expect(rail).toHaveCount(0);
  });
});
